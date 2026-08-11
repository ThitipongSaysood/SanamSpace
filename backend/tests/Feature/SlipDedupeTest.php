<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Court;
use App\Models\Customer;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\PaymentSlip;
use App\Services\SlipVerificationService;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Phase 0 slip screening: a re-used slip (same file hash or transaction ref) is
 * flagged so staff don't approve one transfer for several bookings.
 */
class SlipDedupeTest extends TestCase
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

    /** A pending-review payment with one uploaded slip. */
    private function paymentWithSlip(array $slip = [], string $status = 'pending_review'): PaymentSlip
    {
        $court = Court::where('organization_id', $this->org()->id)->firstOrFail();
        $customer = Customer::create(['organization_id' => $this->org()->id, 'display_name' => 'ลูกค้า']);
        $booking = Booking::create([
            'organization_id' => $this->org()->id,
            'branch_id' => $court->branch_id,
            'court_id' => $court->id,
            'customer_id' => $customer->id,
            'code' => 'BKF-'.Str::random(5),
            'date' => '2026-08-20', 'start' => '18:00', 'end' => '19:00', 'amount' => 250,
            'status' => 'pending_payment',
        ]);
        $payment = Payment::create([
            'organization_id' => $this->org()->id,
            'booking_id' => $booking->id,
            'customer_id' => $customer->id,
            'method' => 'promptpay', 'amount' => 250, 'status' => $status,
        ]);

        return $payment->slips()->create(array_merge([
            'organization_id' => $this->org()->id,
            'file_path' => 'slips/x.jpg', 'url' => 'http://x/x.jpg',
            'uploaded_at' => now(),
            'sha256' => str_repeat('a', 64),
        ], $slip));
    }

    public function test_the_same_file_on_another_payment_is_flagged_duplicate(): void
    {
        $this->paymentWithSlip(['sha256' => str_repeat('b', 64)], status: 'approved');
        $second = $this->paymentWithSlip(['sha256' => str_repeat('b', 64)]);

        $prior = app(SlipVerificationService::class)->screen($second->fresh());

        $this->assertNotNull($prior);
        $this->assertSame('duplicate', $second->fresh()->verify_status);
    }

    public function test_the_same_transaction_ref_is_flagged_even_if_the_image_differs(): void
    {
        $this->paymentWithSlip(['sha256' => str_repeat('c', 64), 'trans_ref' => 'TX-9001'], status: 'approved');
        $second = $this->paymentWithSlip(['sha256' => str_repeat('d', 64), 'trans_ref' => 'TX-9001']);

        app(SlipVerificationService::class)->screen($second->fresh());

        $this->assertSame('duplicate', $second->fresh()->verify_status);
    }

    public function test_a_unique_slip_is_left_unchecked(): void
    {
        $slip = $this->paymentWithSlip(['sha256' => str_repeat('e', 64), 'trans_ref' => 'TX-UNIQUE']);

        app(SlipVerificationService::class)->screen($slip->fresh());

        $this->assertSame('unchecked', $slip->fresh()->verify_status);
    }

    public function test_reuploading_to_the_same_payment_is_not_a_duplicate(): void
    {
        $first = $this->paymentWithSlip(['sha256' => str_repeat('f', 64)]);
        // A second slip on the SAME payment (customer re-uploaded a clearer photo).
        $second = $first->payment->slips()->create([
            'organization_id' => $this->org()->id,
            'file_path' => 'slips/y.jpg', 'url' => 'http://x/y.jpg',
            'uploaded_at' => now(), 'sha256' => str_repeat('f', 64),
        ]);

        app(SlipVerificationService::class)->screen($second->fresh());

        $this->assertSame('unchecked', $second->fresh()->verify_status);
    }

    public function test_owner_payments_queue_exposes_the_duplicate_flag(): void
    {
        $this->paymentWithSlip(['sha256' => str_repeat('g', 64)], status: 'approved');
        $dupSlip = $this->paymentWithSlip(['sha256' => str_repeat('g', 64)]);
        app(SlipVerificationService::class)->screen($dupSlip->fresh());

        $this->app['auth']->forgetGuards();
        $token = $this->postJson('/api/v1/auth/admin/login', ['email' => 'owner@everyday.test', 'password' => 'password'])->json('token');
        $this->app['auth']->forgetGuards();

        $row = collect($this->withToken($token)->getJson('/api/v1/owner/payments?status=pending_review')->json('data'))
            ->firstWhere('id', $dupSlip->payment_id);

        $this->assertTrue($row['slipDuplicate']);
    }
}
