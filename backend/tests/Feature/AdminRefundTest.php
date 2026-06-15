<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Court;
use App\Models\Customer;
use App\Models\Organization;
use App\Models\Refund;
use App\Models\Wallet;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Admin (super-admin) refund oversight: NOT org-scoped — the platform operator
 * sees and can approve/reject every org's refund. Money logic lives in
 * RefundService; these tests assert the wallet credit + state transition land.
 */
class AdminRefundTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    /** Bearer token for the seeded platform super admin (copied from SuperAdminApiTest). */
    private function superToken(): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'super@sanamspace.test',
            'password' => 'password',
        ])->json('token');
    }

    /**
     * Create a `requested` refund (with its own customer + booking) for the given org slug.
     */
    private function seedRefund(string $orgSlug, string $bookingCode, float $amount, string $custName): Refund
    {
        $org = Organization::where('slug', $orgSlug)->firstOrFail();
        $court = Court::where('organization_id', $org->id)->firstOrFail();

        $customer = Customer::create([
            'organization_id' => $org->id,
            'line_user_id' => 'Uref'.uniqid(),
            'display_name' => $custName,
        ]);

        $booking = Booking::create([
            'organization_id' => $org->id,
            'branch_id' => $court->branch_id,
            'court_id' => $court->id,
            'customer_id' => $customer->id,
            'code' => $bookingCode,
            'date' => now()->toDateString(),
            'start' => '18:00',
            'end' => '19:00',
            'amount' => $amount,
            'status' => 'confirmed',
        ]);

        return Refund::create([
            'organization_id' => $org->id,
            'booking_id' => $booking->id,
            'customer_id' => $customer->id,
            'amount' => $amount,
            'reason' => 'ลูกค้ายกเลิก',
            'status' => 'requested',
            'requested_by' => 'customer',
        ]);
    }

    public function test_index_returns_refunds_from_all_orgs(): void
    {
        $everydayRefund = $this->seedRefund('everyday-badminton', 'BKEVR000001', 250, 'คุณเอเวอรี่');
        $tsrRefund = $this->seedRefund('tsr-arena', 'BKTSR000001', 600, 'TSR Customer');

        $response = $this->withToken($this->superToken())
            ->getJson('/api/v1/admin/refunds')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonStructure([
                'data' => [[
                    'id', 'bookingId', 'bookingCode', 'organizationName', 'customerName',
                    'amount', 'reason', 'status', 'method', 'requestedBy', 'note',
                    'createdAt', 'processedAt',
                ]],
            ]);

        // Both orgs present -> NOT org-scoped.
        $byId = collect($response->json('data'))->keyBy('id');

        $this->assertSame('Everyday Badminton', $byId[$everydayRefund->id]['organizationName']);
        $this->assertSame('TSR Arena', $byId[$tsrRefund->id]['organizationName']);
        $this->assertSame('BKTSR000001', $byId[$tsrRefund->id]['bookingCode']);
        $this->assertSame('TSR Customer', $byId[$tsrRefund->id]['customerName']);
        $this->assertEqualsWithDelta(600.0, $byId[$tsrRefund->id]['amount'], 0.001);
        $this->assertSame('customer', $byId[$tsrRefund->id]['requestedBy']);
    }

    public function test_index_puts_requested_before_processed(): void
    {
        $processed = $this->seedRefund('everyday-badminton', 'BKOLD000001', 100, 'Old');
        $processed->update(['status' => 'rejected', 'processed_at' => now()]);

        $pending = $this->seedRefund('tsr-arena', 'BKNEW000001', 200, 'New');

        $ids = collect(
            $this->withToken($this->superToken())
                ->getJson('/api/v1/admin/refunds')
                ->assertOk()
                ->json('data')
        )->pluck('id');

        // Requested bubbles to the top regardless of created_at.
        $this->assertSame($pending->id, $ids->first());
    }

    public function test_approve_with_wallet_credits_customer_and_cancels_booking(): void
    {
        $refund = $this->seedRefund('tsr-arena', 'BKTSR000002', 600, 'TSR Customer');

        $this->withToken($this->superToken())
            ->postJson("/api/v1/admin/refunds/{$refund->id}/approve", ['method' => 'wallet'])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.method', 'wallet');

        $refund->refresh();
        $this->assertSame('approved', $refund->status);
        $this->assertNotNull($refund->processed_at);

        // Booking is cancelled.
        $this->assertSame('cancelled', $refund->booking->status);

        // Wallet for THAT customer (in THAT org) was credited the refund amount.
        $wallet = Wallet::where('organization_id', $refund->organization_id)
            ->where('customer_id', $refund->customer_id)
            ->firstOrFail();
        $this->assertEqualsWithDelta(600.0, (float) $wallet->balance, 0.001);
    }

    public function test_approve_with_manual_records_only_and_does_not_credit_wallet(): void
    {
        $refund = $this->seedRefund('everyday-badminton', 'BKEVR000002', 250, 'คุณเอเวอรี่');

        $this->withToken($this->superToken())
            ->postJson("/api/v1/admin/refunds/{$refund->id}/approve", ['method' => 'manual', 'note' => 'โอนสดแล้ว'])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.method', 'manual')
            ->assertJsonPath('data.note', 'โอนสดแล้ว');

        // No wallet created/credited for a manual refund.
        $this->assertNull(
            Wallet::where('customer_id', $refund->customer_id)->first()
        );
    }

    public function test_reject_sets_rejected_and_moves_no_money(): void
    {
        $refund = $this->seedRefund('tsr-arena', 'BKTSR000003', 600, 'TSR Customer');

        $this->withToken($this->superToken())
            ->postJson("/api/v1/admin/refunds/{$refund->id}/reject", ['note' => 'ไม่เข้าเงื่อนไข'])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected')
            ->assertJsonPath('data.note', 'ไม่เข้าเงื่อนไข');

        $refund->refresh();
        $this->assertSame('rejected', $refund->status);
        $this->assertNotNull($refund->processed_at);

        // No wallet movement, booking untouched (still confirmed).
        $this->assertNull(Wallet::where('customer_id', $refund->customer_id)->first());
        $this->assertSame('confirmed', $refund->booking->status);
    }

    public function test_approving_an_already_processed_refund_is_rejected(): void
    {
        $refund = $this->seedRefund('everyday-badminton', 'BKEVR000003', 250, 'คุณเอเวอรี่');
        $token = $this->superToken();

        $this->withToken($token)
            ->postJson("/api/v1/admin/refunds/{$refund->id}/approve", ['method' => 'wallet'])
            ->assertOk();

        // Second approve is guarded by RefundService (state must be `requested`).
        $this->app['auth']->forgetGuards();
        $this->withToken($token)
            ->postJson("/api/v1/admin/refunds/{$refund->id}/approve", ['method' => 'wallet'])
            ->assertStatus(422);
    }

    public function test_non_super_admin_is_forbidden(): void
    {
        // Seeded org owner -> authenticated User but not a super admin -> 403.
        $ownerToken = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');

        $this->withToken($ownerToken)
            ->getJson('/api/v1/admin/refunds')
            ->assertForbidden();
    }
}
