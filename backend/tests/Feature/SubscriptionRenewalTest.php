<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Organization;
use App\Models\PlatformSetting;
use App\Models\Subscription;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Renewing a venue's SanamSpace subscription by bank transfer.
 *
 * The rule the money depends on: uploading a slip proves nothing on its own —
 * only a Super Admin's approval moves `subscriptions.ends_at`, and it may only
 * do so once per invoice.
 *
 * Seeded state: Everyday Badminton is on Pro (฿3,990/month) ending in 18 days.
 */
class SubscriptionRenewalTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function ownerToken(): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');
    }

    private function adminToken(): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'super@sanamspace.test',
            'password' => 'password',
        ])->json('token');
    }

    /**
     * Act as the holder of $token.
     *
     * Laravel keeps the resolved guard user between HTTP calls inside a single
     * test, so a bare second withToken() would still be authenticated as the
     * first user — which silently turned admin calls into owner calls here.
     */
    private function as(string $token): static
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    private function everyday(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    private function subscriptionOf(Organization $org): Subscription
    {
        return Subscription::where('organization_id', $org->id)->latest('created_at')->firstOrFail();
    }

    /** Push the venue's plan past its end date. */
    private function expire(Organization $org): void
    {
        $this->subscriptionOf($org)->update(['ends_at' => now()->subDay()]);
    }

    /** Raise an invoice as the owner and return its id. */
    private function raise(string $token, int $months = 1): string
    {
        return $this->as($token)
            ->postJson('/api/v1/owner/billing/renew', ['periodMonths' => $months])
            ->assertCreated()
            ->json('data.id');
    }

    // --- Seeing what you owe -------------------------------------------------

    public function test_owner_sees_plan_expiry_and_days_remaining(): void
    {
        $this->as($this->ownerToken())->getJson('/api/v1/owner/billing')
            ->assertOk()
            ->assertJsonPath('data.subscription.planName', 'Pro')
            ->assertJsonPath('data.subscription.price', 3990)
            ->assertJsonPath('data.subscription.isExpired', false)
            ->assertJsonPath('data.subscription.daysRemaining', 18)
            ->assertJsonPath('data.outstandingInvoice', null);
    }

    // --- Raising the invoice -------------------------------------------------

    public function test_renew_raises_an_unpaid_invoice_priced_by_period(): void
    {
        $this->as($this->ownerToken())
            ->postJson('/api/v1/owner/billing/renew', ['periodMonths' => 3])
            ->assertCreated()
            ->assertJsonPath('data.status', 'unpaid')
            ->assertJsonPath('data.source', 'owner')
            ->assertJsonPath('data.periodMonths', 3)
            ->assertJsonPath('data.planName', 'Pro')
            ->assertJsonPath('data.amount', 11970); // 3,990 × 3
    }

    /** Reopening the page must not stack a second invoice to reconcile. */
    public function test_renewing_twice_returns_the_same_outstanding_invoice(): void
    {
        $token = $this->ownerToken();
        $first = $this->raise($token);
        $second = $this->raise($token);

        $this->assertSame($first, $second);
        $this->assertSame(1, Invoice::where('organization_id', $this->everyday()->id)->count());
    }

    public function test_renew_rejects_an_unsupported_period(): void
    {
        $this->as($this->ownerToken())
            ->postJson('/api/v1/owner/billing/renew', ['periodMonths' => 7])
            ->assertStatus(422);
    }

    // --- Paying it -----------------------------------------------------------

    public function test_instructions_return_a_scannable_promptpay_payload_and_bank(): void
    {
        PlatformSetting::query()->firstOrCreate([])->update([
            'promptpay_id' => '0812345678',
            'promptpay_name' => 'SanamSpace Co.',
            'bank_name' => 'กสิกรไทย',
            'bank_account_name' => 'SanamSpace Co.',
            'bank_account_number' => '123-4-56789-0',
        ]);

        $token = $this->ownerToken();
        $id = $this->raise($token);

        $res = $this->as($token)
            ->getJson("/api/v1/owner/billing/invoices/{$id}/instructions")
            ->assertOk()
            ->assertJsonPath('amount', 3990)
            ->assertJsonPath('payTo', 'SanamSpace Co.')
            ->assertJsonPath('bank.accountNumber', '123-4-56789-0');

        // EMVCo payload: starts with the format indicator and carries PromptPay's AID.
        $payload = $res->json('promptpay.payload');
        $this->assertStringStartsWith('000201', $payload);
        $this->assertStringContainsString('A000000677010111', $payload);
    }

    public function test_uploading_a_slip_moves_the_invoice_to_pending_review(): void
    {
        Storage::fake('public');
        $token = $this->ownerToken();
        $id = $this->raise($token);

        $this->as($token)
            ->postJson("/api/v1/owner/billing/invoices/{$id}/slip", [
                'slip' => UploadedFile::fake()->image('slip.png'),
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'pending_review');

        // The slip alone must not buy any time.
        $this->assertSame(18, (int) now()->startOfDay()->diffInDays(
            $this->subscriptionOf($this->everyday())->ends_at->startOfDay(), false,
        ));
    }

    public function test_slip_must_be_an_image(): void
    {
        Storage::fake('public');
        $token = $this->ownerToken();
        $id = $this->raise($token);

        $this->as($token)
            ->postJson("/api/v1/owner/billing/invoices/{$id}/slip", [
                'slip' => UploadedFile::fake()->create('notaslip.pdf', 100, 'application/pdf'),
            ])
            ->assertStatus(422);
    }

    // --- Approval: the only thing that moves the end date --------------------

    /** Renewing early must keep the days already paid for. */
    public function test_approval_extends_from_the_existing_end_date(): void
    {
        $admin = $this->adminToken();
        $before = $this->subscriptionOf($this->everyday())->ends_at->copy();
        $id = $this->raise($this->ownerToken(), 3);

        $this->as($admin)
            ->postJson("/api/v1/admin/invoices/{$id}/pay")
            ->assertOk()
            ->assertJsonPath('data.status', 'paid');

        $this->assertTrue(
            $this->subscriptionOf($this->everyday())->ends_at->isSameDay($before->addMonths(3)),
            'the 3 months should be added to the old end date, not to today',
        );
    }

    /** Renewing after a lapse starts today — the dead time is not back-dated away. */
    public function test_approval_after_expiry_extends_from_today(): void
    {
        $admin = $this->adminToken();
        $org = $this->everyday();
        $this->expire($org);

        $id = $this->raise($this->ownerToken());
        $this->as($admin)->postJson("/api/v1/admin/invoices/{$id}/pay")->assertOk();

        $this->assertTrue(
            $this->subscriptionOf($org)->ends_at->isSameDay(now()->addMonth()),
            'a lapsed plan should restart from today',
        );
        $this->assertSame('active', $this->subscriptionOf($org)->status);
    }

    public function test_approval_records_a_platform_transaction(): void
    {
        $admin = $this->adminToken();
        $id = $this->raise($this->ownerToken());
        $this->as($admin)->postJson("/api/v1/admin/invoices/{$id}/pay")->assertOk();

        $this->assertDatabaseHas('platform_transactions', [
            'organization_name' => 'Everyday Badminton',
            'type' => 'subscription',
            'amount' => 3990.00,
            'status' => 'success',
        ]);
    }

    /** The guard that stops one transfer buying two months. */
    public function test_an_invoice_cannot_be_approved_twice(): void
    {
        $admin = $this->adminToken();
        $id = $this->raise($this->ownerToken());

        $this->as($admin)->postJson("/api/v1/admin/invoices/{$id}/pay")->assertOk();
        $after = $this->subscriptionOf($this->everyday())->ends_at->copy();

        $this->as($admin)->postJson("/api/v1/admin/invoices/{$id}/pay")->assertStatus(422);

        $this->assertTrue($this->subscriptionOf($this->everyday())->ends_at->equalTo($after));
        $this->assertSame(1, \App\Models\PlatformTransaction::where('type', 'subscription')->count());
    }

    public function test_rejecting_a_slip_leaves_the_subscription_untouched(): void
    {
        $admin = $this->adminToken();
        $before = $this->subscriptionOf($this->everyday())->ends_at->copy();
        $id = $this->raise($this->ownerToken());

        $this->as($admin)
            ->postJson("/api/v1/admin/invoices/{$id}/reject", ['reason' => 'ยอดไม่ตรง'])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected')
            ->assertJsonPath('data.rejectReason', 'ยอดไม่ตรง');

        $this->assertTrue($this->subscriptionOf($this->everyday())->ends_at->equalTo($before));
    }

    // --- What expiry actually blocks -----------------------------------------

    public function test_expired_venue_is_locked_out_of_the_owner_portal(): void
    {
        $this->expire($this->everyday());

        $this->as($this->ownerToken())->getJson('/api/v1/owner/dashboard')
            ->assertStatus(402)
            ->assertJsonPath('code', 'subscription_expired');

        $this->as($this->ownerToken())->getJson('/api/v1/owner/bookings')->assertStatus(402);
    }

    /** Otherwise an expired venue could never pay its way back in. */
    public function test_expired_venue_can_still_reach_billing_and_renew(): void
    {
        $this->expire($this->everyday());
        $token = $this->ownerToken();

        $this->as($token)->getJson('/api/v1/owner/billing')
            ->assertOk()
            ->assertJsonPath('data.subscription.isExpired', true);

        $this->as($token)->postJson('/api/v1/owner/billing/renew', ['periodMonths' => 1])
            ->assertCreated();
    }

    /**
     * The deliberate line: the venue's customers already paid the venue, so an
     * unpaid platform bill must not stop them booking.
     */
    public function test_customers_keep_booking_while_the_venue_is_expired(): void
    {
        $this->expire($this->everyday());

        // The customer-facing venue is still readable at all — how many
        // branches it has is not what an unpaid platform bill would change.
        $this->withHeader('X-Venue-Slug', 'everyday-badminton')
            ->getJson('/api/v1/branches')->assertOk()->assertJsonPath('data.0.id', 'everyday-badminton');

        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');

        $this->withHeader('X-Venue-Slug', 'everyday-badminton')
            ->getJson("/api/v1/courts/{$courtId}/schedules?date=".now()->addDay()->toDateString())
            ->assertOk();

        $customer = $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => 'Uexpiredvenue',
            'displayName' => 'Still Booking',
        ])->json('token');

        $this->as($customer)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => now()->addDay()->toDateString(),
            'start' => '09:00',
            'end' => '10:00',
        ])->assertCreated();
    }

    // --- Admin-issued invoices + isolation -----------------------------------

    public function test_admin_can_bill_a_venue_directly(): void
    {
        $admin = $this->adminToken();
        $owner = $this->ownerToken();

        $this->as($admin)
            ->postJson('/api/v1/admin/invoices', [
                'organizationId' => $this->everyday()->id,
                'periodMonths' => 12,
            ])
            ->assertCreated()
            ->assertJsonPath('data.source', 'admin')
            ->assertJsonPath('data.amount', 47880); // 3,990 × 12

        // …and the venue sees it waiting on its own billing page.
        $this->as($owner)->getJson('/api/v1/owner/billing')
            ->assertOk()
            ->assertJsonPath('data.outstandingInvoice.source', 'admin');
    }

    public function test_pending_review_invoices_come_first_for_the_admin(): void
    {
        Storage::fake('public');
        $admin = $this->adminToken();
        $token = $this->ownerToken();
        $id = $this->raise($token);
        $this->as($token)->postJson("/api/v1/owner/billing/invoices/{$id}/slip", [
            'slip' => UploadedFile::fake()->image('slip.png'),
        ])->assertOk();

        $this->as($admin)->getJson('/api/v1/admin/invoices')
            ->assertOk()
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.status', 'pending_review');
    }

    public function test_a_venue_cannot_touch_another_venues_invoice(): void
    {
        $tsr = Organization::where('slug', 'tsr-arena')->firstOrFail();
        $foreign = Invoice::create([
            'number' => 'INV-TEST-0001',
            'organization_id' => $tsr->id,
            'organization_name' => $tsr->name,
            'amount' => 1990,
            'status' => 'unpaid',
            'issue_date' => now()->format('Y-m-d'),
            'due_date' => now()->addDays(7)->format('Y-m-d'),
        ]);

        $token = $this->ownerToken();

        $this->as($token)
            ->getJson("/api/v1/owner/billing/invoices/{$foreign->id}/instructions")
            ->assertNotFound();

        $this->as($token)->getJson('/api/v1/owner/billing/invoices')
            ->assertOk()
            ->assertJsonMissing(['number' => 'INV-TEST-0001']);
    }

    public function test_billing_requires_a_staff_account(): void
    {
        $customer = $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => 'Ubillingcust',
            'displayName' => 'Cust',
        ])->json('token');

        $this->as($customer)->getJson('/api/v1/owner/billing')->assertForbidden();
    }
}
