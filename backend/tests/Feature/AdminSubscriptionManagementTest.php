<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\PlatformTransaction;
use App\Models\Subscription;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Running a venue's subscription from the platform side.
 *
 * The screen that shows an expiry date is where an admin is standing when they
 * discover a venue is about to lapse, so it is where renewing, re-planning and
 * trialling have to work. Before this, renewing meant three screens and fixing
 * a date meant editing the database.
 */
class AdminSubscriptionManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
        Mail::fake();
    }

    private function superToken(): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'super@sanamspace.test',
            'password' => 'password',
        ])->json('token');
    }

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    private function planId(string $code): string
    {
        return Plan::where('code', $code)->value('id');
    }

    // --- Changing plan -----------------------------------------------------

    /**
     * The bug this pins down: the organisation-addressed endpoint used to
     * create a subscription with no end date, and `isExpired()` reads a null
     * `ends_at` as "never expires". Changing the plan of a venue that had none
     * handed it the platform free, forever, with no invoice to show for it.
     */
    public function test_changing_the_plan_of_a_venue_with_none_still_gives_it_an_end_date(): void
    {
        $org = $this->org();
        $org->subscriptions()->forceDelete();

        $this->withToken($this->superToken())
            ->putJson("/api/v1/admin/organizations/{$org->slug}/plan", ['planId' => $this->planId('business')])
            ->assertOk()
            ->assertJsonPath('data.subscription.planName', 'Business');

        $sub = Subscription::where('organization_id', $org->id)->firstOrFail();
        $this->assertNotNull($sub->ends_at, 'a subscription with no end date never expires');
        $this->assertTrue($sub->ends_at->isFuture());
    }

    /** Both entry points are the same decision, so they must land in one place. */
    public function test_the_two_change_plan_routes_agree(): void
    {
        $org = $this->org();
        $token = $this->superToken();

        $this->withToken($token)
            ->putJson("/api/v1/admin/organizations/{$org->slug}/plan", ['planId' => $this->planId('starter')])
            ->assertOk();
        $this->assertSame('Starter', $org->fresh()->activeSubscription->plan->name);

        $subId = $org->fresh()->activeSubscription->id;
        $this->withToken($token)
            ->putJson("/api/v1/admin/subscriptions/{$subId}/plan", ['planId' => $this->planId('pro')])
            ->assertOk();

        $this->assertSame('Pro', $org->fresh()->activeSubscription->plan->name);
        // One subscription throughout — neither route may fork a second one.
        $this->assertSame(1, Subscription::where('organization_id', $org->id)->count());
    }

    // --- Renewing ----------------------------------------------------------

    public function test_renewing_raises_an_invoice_and_does_not_extend_until_it_is_paid(): void
    {
        $org = $this->org();
        $before = $org->activeSubscription->ends_at;

        $this->withToken($this->superToken())
            ->postJson("/api/v1/admin/organizations/{$org->slug}/renew", ['months' => 3])
            ->assertOk()
            ->assertJsonPath('invoice.periodMonths', 3)
            ->assertJsonPath('reusedOutstanding', false);

        $this->assertSame(
            $before?->toDateTimeString(),
            $org->fresh()->activeSubscription->ends_at?->toDateTimeString(),
            'an unpaid invoice must not buy any time',
        );
    }

    /**
     * Money that arrived before the paperwork — a transfer the venue phoned
     * about. The point is that it still goes through invoice and receipt: the
     * alternative an admin reaches for is editing the expiry date, and then
     * the payment exists nowhere.
     */
    public function test_renewing_as_already_paid_extends_the_plan_and_records_the_money(): void
    {
        $org = $this->org();
        $before = $org->activeSubscription->ends_at;

        $response = $this->withToken($this->superToken())
            ->postJson("/api/v1/admin/organizations/{$org->slug}/renew", ['months' => 3, 'markPaid' => true])
            ->assertOk()
            ->assertJsonPath('invoice.status', 'paid');

        $this->assertNotNull($response->json('invoice.receiptNumber'));
        $this->assertSame(
            $before->copy()->addMonths(3)->toDateString(),
            $org->fresh()->activeSubscription->ends_at->toDateString(),
            'renewing early keeps the days already paid for',
        );
        $this->assertSame(1, PlatformTransaction::where('type', 'subscription')->count());
    }

    public function test_renewing_reuses_an_invoice_the_venue_already_owes(): void
    {
        $org = $this->org();
        $token = $this->superToken();

        $first = $this->withToken($token)
            ->postJson("/api/v1/admin/organizations/{$org->slug}/renew", ['months' => 1])
            ->json('invoice.id');

        $this->withToken($token)
            ->postJson("/api/v1/admin/organizations/{$org->slug}/renew", ['months' => 6])
            ->assertOk()
            ->assertJsonPath('invoice.id', $first)
            ->assertJsonPath('reusedOutstanding', true);

        // Two open invoices and one transfer is a puzzle nobody can solve.
        $this->assertSame(1, Invoice::where('organization_id', $org->id)->count());
    }

    // --- The manual expiry date -------------------------------------------

    public function test_setting_the_expiry_by_hand_needs_a_reason_and_is_written_down(): void
    {
        $org = $this->org();
        $token = $this->superToken();
        $target = now()->addMonths(2)->toDateString();

        $this->withToken($token)
            ->putJson("/api/v1/admin/organizations/{$org->slug}/expiry", ['endsAt' => $target])
            ->assertStatus(422);

        $this->withToken($token)
            ->putJson("/api/v1/admin/organizations/{$org->slug}/expiry", [
                'endsAt' => $target,
                'reason' => 'ตกลงกันทางโทรศัพท์ · ชดเชยระบบล่ม',
            ])
            ->assertOk();

        $this->assertSame($target, $org->fresh()->activeSubscription->ends_at->toDateString());

        $log = AuditLog::where('action', 'แก้วันหมดอายุด้วยมือ')->firstOrFail();
        $this->assertStringContainsString('ชดเชยระบบล่ม', $log->detail);
        $this->assertSame($org->id, $log->organization_id);
    }

    public function test_a_venue_with_no_plan_cannot_be_given_an_expiry_date(): void
    {
        $org = $this->org();
        $org->subscriptions()->forceDelete();

        $this->withToken($this->superToken())
            ->putJson("/api/v1/admin/organizations/{$org->slug}/expiry", [
                'endsAt' => now()->addMonth()->toDateString(),
                'reason' => 'ทดสอบ',
            ])
            ->assertStatus(422);
    }

    // --- Trials ------------------------------------------------------------

    public function test_a_trial_runs_the_venue_and_locks_it_when_it_ends(): void
    {
        $org = $this->org();

        $this->withToken($this->superToken())
            ->postJson("/api/v1/admin/organizations/{$org->slug}/trial", [
                'planId' => $this->planId('pro'),
                'days' => 14,
            ])
            ->assertOk()
            ->assertJsonPath('data.trial.onTrial', true);

        $org = $org->fresh();
        $this->assertTrue($org->onTrial());
        $this->assertSame(
            now()->addDays(14)->toDateString(),
            $org->activeSubscription->ends_at->toDateString(),
        );
        // Deliberately still 'active': every lockout path reads ends_at, and a
        // separate status would blank the plan on every screen that loads a
        // venue through activeSubscription().
        $this->assertSame('active', $org->activeSubscription->status);

        $this->travel(15)->days();
        $this->assertTrue(app(\App\Services\SubscriptionRenewalService::class)
            ->isExpired($org->fresh()->activeSubscription));
    }

    public function test_paying_ends_the_trial(): void
    {
        $org = $this->org();
        $token = $this->superToken();

        $this->withToken($token)->postJson("/api/v1/admin/organizations/{$org->slug}/trial", [
            'planId' => $this->planId('pro'),
            'days' => 30,
        ])->assertOk();

        $this->withToken($token)
            ->postJson("/api/v1/admin/organizations/{$org->slug}/renew", ['months' => 1, 'markPaid' => true])
            ->assertOk();

        $org = $org->fresh();
        $this->assertFalse($org->onTrial(), 'money changed hands, so it is not a trial any more');
        // Ended, not erased: when they started trying the product is worth keeping.
        $this->assertNotNull($org->trial_start_at);
        $this->assertNotNull($org->trial_end_at);
    }

    // --- The audit log -----------------------------------------------------

    public function test_admin_actions_are_written_to_the_audit_log(): void
    {
        $org = $this->org();
        $token = $this->superToken();
        $seeded = AuditLog::count();

        $this->withToken($token)->postJson("/api/v1/admin/organizations/{$org->slug}/suspend")->assertOk();
        $this->withToken($token)->putJson("/api/v1/admin/organizations/{$org->slug}/plan", [
            'planId' => $this->planId('business'),
        ])->assertOk();
        $this->withToken($token)->postJson("/api/v1/admin/organizations/{$org->slug}/impersonate")->assertOk();

        $this->assertSame($seeded + 3, AuditLog::count());

        $actions = AuditLog::where('organization_id', $org->id)->pluck('action')->all();
        $this->assertContains('ระงับการใช้งานสนาม', $actions);
        $this->assertContains('เปลี่ยนแพ็กเกจ', $actions);
        // The entry that matters most: for a while afterwards, anything done
        // in that venue's portal was done by a platform admin.
        $this->assertContains('สวมสิทธิ์เจ้าของสนาม', $actions);

        // Denormalised on purpose, so the entry still names someone after the
        // account is renamed or removed.
        $this->assertSame('Platform Admin', AuditLog::latest('created_at')->first()->user_name);
    }

    public function test_the_audit_log_can_be_asked_about_one_venue_only(): void
    {
        $token = $this->superToken();
        $org = $this->org();
        $other = Organization::where('slug', '!=', 'everyday-badminton')->firstOrFail();

        $this->withToken($token)->postJson("/api/v1/admin/organizations/{$org->slug}/suspend")->assertOk();
        $this->withToken($token)->postJson("/api/v1/admin/organizations/{$other->slug}/suspend")->assertOk();

        $rows = $this->withToken($token)
            ->getJson("/api/v1/admin/audit-logs?organizationId={$org->slug}")
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $rows);
        $this->assertSame($org->id, $rows[0]['organizationId']);
    }

    /** An unknown venue must return nothing, never quietly widen to everything. */
    public function test_filtering_by_an_unknown_venue_returns_nothing(): void
    {
        $this->withToken($this->superToken())
            ->getJson('/api/v1/admin/audit-logs?organizationId=not-a-venue')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }
}
