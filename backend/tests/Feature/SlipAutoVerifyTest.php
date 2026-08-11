<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Court;
use App\Models\Customer;
use App\Models\Organization;
use App\Models\OrganizationSetting;
use App\Models\Payment;
use App\Models\PaymentSlip;
use App\Services\Slip\SlipVerifier;
use App\Services\SlipVerificationService;
use App\Support\SlipVerification;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Phase 1 auto-verify: a slip that clears the verifier is approved without a
 * human, but only in `auto` mode and only when it is real, covers the amount,
 * and paid into the venue's own account. Everything else waits in the queue.
 */
class SlipAutoVerifyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    private function configure(string $mode): void
    {
        OrganizationSetting::query()->updateOrCreate(
            ['organization_id' => $this->org()->id],
            ['slip_verify_mode' => $mode, 'promptpay_id' => '0812345678'],
        );
        // The platform master switch is the admin's gate; on by default here so
        // each test can isolate the org toggle / plan / provider behaviour.
        \App\Models\PlatformSetting::query()->firstOrCreate([])->update([
            'slip_verify_enabled' => true, 'slip_verify_driver' => 'slip2go',
        ]);
    }

    /** Bind a stub provider that returns $result (or throws). */
    private function bindVerifier(?SlipVerification $result, bool $throw = false): void
    {
        $this->app->bind(SlipVerifier::class, fn () => new class($result, $throw) implements SlipVerifier
        {
            public function __construct(private ?SlipVerification $result, private bool $throw) {}

            public function verify(PaymentSlip $slip): SlipVerification
            {
                if ($this->throw) {
                    throw new \RuntimeException('provider down');
                }

                return $this->result ?? SlipVerification::fail();
            }
        });
    }

    private function pendingSlip(): PaymentSlip
    {
        $court = Court::where('organization_id', $this->org()->id)->firstOrFail();
        $customer = Customer::create(['organization_id' => $this->org()->id, 'display_name' => 'ลูกค้า']);
        $booking = Booking::create([
            'organization_id' => $this->org()->id, 'branch_id' => $court->branch_id, 'court_id' => $court->id,
            'customer_id' => $customer->id, 'code' => 'BKF-'.Str::random(5),
            'date' => '2026-08-20', 'start' => '18:00', 'end' => '19:00', 'amount' => 250, 'status' => 'pending_payment',
        ]);
        $payment = Payment::create([
            'organization_id' => $this->org()->id, 'booking_id' => $booking->id, 'customer_id' => $customer->id,
            'method' => 'promptpay', 'amount' => 250, 'status' => 'pending_review',
        ]);

        return $payment->slips()->create([
            'organization_id' => $this->org()->id, 'file_path' => 'slips/x.jpg', 'url' => 'http://x/x.jpg',
            'uploaded_at' => now(), 'sha256' => str_repeat(substr(md5(Str::random()), 0, 1), 64).Str::random(0),
        ]);
    }

    private function goodSlip(): SlipVerification
    {
        return new SlipVerification(ok: true, amount: 250, receiverRef: '0812345678', transRef: 'TX-'.Str::random(6));
    }

    public function test_auto_mode_approves_a_slip_that_passes(): void
    {
        $this->configure('auto');
        $this->bindVerifier($this->goodSlip());
        $slip = $this->pendingSlip();

        app(SlipVerificationService::class)->process($slip);

        $this->assertSame('approved', $slip->payment->fresh()->status);
        $this->assertSame('confirmed', $slip->payment->booking->fresh()->status);
        $this->assertSame('verified', $slip->fresh()->verify_status);
    }

    public function test_platform_master_switch_off_keeps_everything_manual(): void
    {
        $this->configure('auto');
        $this->bindVerifier($this->goodSlip());
        // Admin flips the global switch off — no venue auto-verifies.
        \App\Models\PlatformSetting::query()->firstOrCreate([])->update(['slip_verify_enabled' => false]);
        $slip = $this->pendingSlip();

        app(SlipVerificationService::class)->process($slip);

        $this->assertSame('pending_review', $slip->payment->fresh()->status);
    }

    public function test_auto_mode_needs_the_plan_feature(): void
    {
        $this->configure('auto');
        $this->bindVerifier($this->goodSlip());
        $slip = $this->pendingSlip();

        // Take slip_auto_verify off this org's plan → auto falls back to manual.
        $planId = \App\Models\Subscription::forOrganization($this->org()->id)->value('plan_id');
        $featureId = \Illuminate\Support\Facades\DB::table('features')->where('code', 'slip_auto_verify')->value('id');
        \Illuminate\Support\Facades\DB::table('plan_features')
            ->where('plan_id', $planId)->where('feature_id', $featureId)->delete();
        \App\Support\PlanFeatures::flush();

        app(SlipVerificationService::class)->process($slip);

        $this->assertSame('pending_review', $slip->payment->fresh()->status);
    }

    public function test_manual_mode_never_auto_approves(): void
    {
        $this->configure('manual');
        $this->bindVerifier($this->goodSlip());
        $slip = $this->pendingSlip();

        app(SlipVerificationService::class)->process($slip);

        $this->assertSame('pending_review', $slip->payment->fresh()->status);
    }

    public function test_a_slip_under_the_amount_stays_manual(): void
    {
        $this->configure('auto');
        $this->bindVerifier(new SlipVerification(ok: true, amount: 100, receiverRef: '0812345678'));
        $slip = $this->pendingSlip();

        app(SlipVerificationService::class)->process($slip);

        $this->assertSame('pending_review', $slip->payment->fresh()->status);
    }

    public function test_a_slip_paid_to_another_account_stays_manual(): void
    {
        $this->configure('auto');
        $this->bindVerifier(new SlipVerification(ok: true, amount: 250, receiverRef: '0899999999'));
        $slip = $this->pendingSlip();

        app(SlipVerificationService::class)->process($slip);

        $this->assertSame('pending_review', $slip->payment->fresh()->status);
    }

    public function test_a_provider_failure_falls_back_to_manual(): void
    {
        $this->configure('auto');
        $this->bindVerifier(null, throw: true);
        $slip = $this->pendingSlip();

        app(SlipVerificationService::class)->process($slip); // must not throw

        $this->assertSame('pending_review', $slip->payment->fresh()->status);
    }

    public function test_processing_twice_approves_only_once(): void
    {
        $this->configure('auto');
        $this->bindVerifier($this->goodSlip());
        $slip = $this->pendingSlip();

        $service = app(SlipVerificationService::class);
        $service->process($slip);
        $service->process($slip->fresh()); // second run is a no-op (already approved)

        $payment = $slip->payment->fresh();
        $this->assertSame('approved', $payment->status);
        // Paid amount was applied exactly once (250, not 500).
        $this->assertEqualsWithDelta(250.0, (float) $payment->booking->fresh()->paid_amount, 0.001);
    }
}
