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
 * Owner-side refund review: list customer requests, approve (credit wallet or
 * record manual), reject. All under auth:sanctum + owner.org, org-scoped to the
 * authed staff user's org (seeded Everyday Badminton owner). The wallet credit
 * + state transition live in RefundService, exercised here end-to-end.
 */
class OwnerRefundTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    /** Admin (staff) bearer token for the seeded Everyday owner. */
    private function ownerToken(): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');
    }

    private function everyday(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    /** Seeded Everyday customer (คุณสมชาย) — has a wallet (balance 580). */
    private function everydayCustomer(Organization $org): Customer
    {
        return Customer::where('organization_id', $org->id)->firstOrFail();
    }

    /** Create a `requested` refund (with a backing booking) in the given org. */
    private function makeRefund(Organization $org, Customer $customer, float $amount = 300, string $code = 'BKED000099'): Refund
    {
        $court = Court::where('organization_id', $org->id)->firstOrFail();

        $booking = Booking::create([
            'organization_id' => $org->id,
            'branch_id' => $court->branch_id,
            'court_id' => $court->id,
            'customer_id' => $customer->id,
            'code' => $code,
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

    public function test_index_lists_org_requested_refunds(): void
    {
        $org = $this->everyday();
        $customer = $this->everydayCustomer($org);
        $refund = $this->makeRefund($org, $customer);

        $this->withToken($this->ownerToken())->getJson('/api/v1/owner/refunds')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonStructure(['data' => [[
                'id', 'bookingId', 'bookingCode', 'customerName', 'amount',
                'reason', 'status', 'method', 'requestedBy', 'note',
                'createdAt', 'processedAt',
            ]]])
            ->assertJsonPath('data.0.id', $refund->id)
            ->assertJsonPath('data.0.status', 'requested')
            ->assertJsonPath('data.0.bookingCode', 'BKED000099')
            ->assertJsonPath('data.0.customerName', $customer->display_name)
            ->assertJsonPath('data.0.requestedBy', 'customer');
    }

    public function test_approve_with_wallet_credits_wallet_and_cancels_booking(): void
    {
        $org = $this->everyday();
        $customer = $this->everydayCustomer($org);
        $refund = $this->makeRefund($org, $customer, 300);

        $wallet = Wallet::where('organization_id', $org->id)
            ->where('customer_id', $customer->id)
            ->firstOrFail();
        $before = (float) $wallet->balance;
        $txnCountBefore = $wallet->transactions()->count();

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/refunds/{$refund->id}/approve", ['method' => 'wallet'])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.method', 'wallet');

        // Wallet credited by the refund amount + a transaction logged.
        $this->assertEquals($before + 300, (float) $wallet->fresh()->balance);
        $this->assertSame($txnCountBefore + 1, $wallet->fresh()->transactions()->count());
        $this->assertDatabaseHas('wallet_transactions', [
            'wallet_id' => $wallet->id,
            'amount' => 300,
        ]);

        // Refund recorded + booking cancelled.
        $this->assertSame('approved', $refund->fresh()->status);
        $this->assertSame('cancelled', $refund->fresh()->booking->status);
    }

    public function test_approve_with_manual_does_not_touch_wallet(): void
    {
        $org = $this->everyday();
        $customer = $this->everydayCustomer($org);
        $refund = $this->makeRefund($org, $customer, 250);

        $wallet = Wallet::where('organization_id', $org->id)
            ->where('customer_id', $customer->id)
            ->firstOrFail();
        $before = (float) $wallet->balance;
        $txnCountBefore = $wallet->transactions()->count();

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/refunds/{$refund->id}/approve", ['method' => 'manual'])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.method', 'manual');

        // Manual refund: status approved, but wallet balance + txns UNCHANGED.
        $this->assertEquals($before, (float) $wallet->fresh()->balance);
        $this->assertSame($txnCountBefore, $wallet->fresh()->transactions()->count());
        $this->assertSame('approved', $refund->fresh()->status);
    }

    public function test_reject_sets_status_rejected(): void
    {
        $org = $this->everyday();
        $customer = $this->everydayCustomer($org);
        $refund = $this->makeRefund($org, $customer);

        $wallet = Wallet::where('organization_id', $org->id)
            ->where('customer_id', $customer->id)
            ->firstOrFail();
        $before = (float) $wallet->balance;

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/refunds/{$refund->id}/reject", ['note' => 'ไม่เข้าเงื่อนไข'])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected')
            ->assertJsonPath('data.note', 'ไม่เข้าเงื่อนไข');

        $this->assertSame('rejected', $refund->fresh()->status);
        // No money moved on reject.
        $this->assertEquals($before, (float) $wallet->fresh()->balance);
    }

    public function test_approving_already_approved_refund_is_422(): void
    {
        $org = $this->everyday();
        $customer = $this->everydayCustomer($org);
        $refund = $this->makeRefund($org, $customer);

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/refunds/{$refund->id}/approve", ['method' => 'wallet'])
            ->assertOk();

        // Second approve hits the RefundService `requested`-only guard.
        $this->app['auth']->forgetGuards();
        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/refunds/{$refund->id}/approve", ['method' => 'wallet'])
            ->assertStatus(422);
    }

    public function test_cross_org_refund_is_404(): void
    {
        // A refund belonging to TSR Arena must be invisible to the Everyday owner.
        $tsr = Organization::where('slug', 'tsr-arena')->firstOrFail();
        $tsrCustomer = Customer::create([
            'organization_id' => $tsr->id,
            'line_user_id' => 'Utsrrefund',
            'display_name' => 'TSR Cust',
        ]);
        $tsrRefund = $this->makeRefund($tsr, $tsrCustomer, 100, 'BKTSR000099');

        $owner = $this->ownerToken(); // Everyday owner

        // Not listed for the Everyday owner.
        $this->withToken($owner)->getJson('/api/v1/owner/refunds')
            ->assertOk()->assertJsonCount(0, 'data');

        // Approve / reject across orgs are 404.
        $this->app['auth']->forgetGuards();
        $this->withToken($owner)
            ->postJson("/api/v1/owner/refunds/{$tsrRefund->id}/approve")
            ->assertNotFound();

        $this->app['auth']->forgetGuards();
        $this->withToken($owner)
            ->postJson("/api/v1/owner/refunds/{$tsrRefund->id}/reject")
            ->assertNotFound();

        $this->assertSame('requested', $tsrRefund->fresh()->status);
    }
}
