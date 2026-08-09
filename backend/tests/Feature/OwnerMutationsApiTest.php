<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Role;
use App\Models\User;
use App\Models\Wallet;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Covers the Owner Portal mutations added to existing sections: staff invite,
 * membership points adjust, wallet topup. All under auth:sanctum + owner.org and
 * org-scoped to the authed staff user's org (seeded Everyday Badminton owner).
 */
class OwnerMutationsApiTest extends TestCase
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

    private function customerToken(string $lineUserId = 'Umut', string $name = 'Mut Cust'): string
    {
        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => $lineUserId,
            'displayName' => $name,
        ])->json('token');
    }

    private function managerRoleId(): string
    {
        return Role::where('code', 'manager')->firstOrFail()->id;
    }

    public function test_staff_invite_creates_user_and_membership(): void
    {
        $roleId = $this->managerRoleId();

        $this->withToken($this->ownerToken())->postJson('/api/v1/owner/staff', [
            'email' => 'new@everyday.test',
            'displayName' => 'พนักงานใหม่',
            'roleId' => $roleId,
        ])
            ->assertCreated()
            ->assertJsonStructure(['data' => ['id', 'displayName', 'email', 'roleName', 'status', 'joinedAt']])
            ->assertJsonPath('data.email', 'new@everyday.test')
            ->assertJsonPath('data.displayName', 'พนักงานใหม่')
            ->assertJsonPath('data.roleName', 'Manager')
            ->assertJsonPath('data.status', 'active');

        $everyday = Organization::where('slug', 'everyday-badminton')->firstOrFail();
        $user = User::where('email', 'new@everyday.test')->firstOrFail();
        $this->assertDatabaseHas('organization_users', [
            'organization_id' => $everyday->id,
            'user_id' => $user->id,
            'status' => 'active',
        ]);
    }

    public function test_staff_invite_duplicate_member_is_422(): void
    {
        $roleId = $this->managerRoleId();

        // owner@everyday.test is already a member of this org.
        $this->withToken($this->ownerToken())->postJson('/api/v1/owner/staff', [
            'email' => 'owner@everyday.test',
            'displayName' => 'Dup',
            'roleId' => $roleId,
        ])->assertStatus(422);
    }

    public function test_membership_points_adjust(): void
    {
        $membership = Membership::firstOrFail(); // seeded Gold, 820 points
        $original = (int) $membership->points;

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/memberships/{$membership->id}/points", ['delta' => 50])
            ->assertOk()
            ->assertJsonPath('data.points', $original + 50);

        $this->assertSame($original + 50, (int) $membership->fresh()->points);
    }

    /**
     * Deducting more than a customer has is refused, not silently floored.
     *
     * It used to clamp to 0 and answer 200, so "take 100,000 from someone with
     * 820" looked like it worked — the staff member had no way to know they had
     * mistyped, and the customer's balance was wrong by 820.
     */
    public function test_deducting_more_points_than_the_customer_has_is_refused(): void
    {
        $membership = Membership::firstOrFail();
        $before = (int) $membership->points;

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/memberships/{$membership->id}/points", ['delta' => -100000])
            ->assertStatus(422)
            ->assertJsonValidationErrors('delta');

        $this->assertSame($before, (int) $membership->fresh()->points);
    }

    public function test_membership_points_adjust_cross_org_is_404(): void
    {
        $tsr = Organization::where('slug', 'tsr-arena')->firstOrFail();
        $tsrCustomer = Customer::create([
            'organization_id' => $tsr->id,
            'line_user_id' => 'Utsrmut',
            'display_name' => 'TSR Cust',
        ]);
        $tsrMembership = Membership::create([
            'organization_id' => $tsr->id,
            'customer_id' => $tsrCustomer->id,
            'tier' => 'Silver',
            'member_id' => 'TSR-0002',
            'points' => 10,
            'expires_at' => '31 ธ.ค. 2567',
        ]);

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/memberships/{$tsrMembership->id}/points", ['delta' => 5])
            ->assertNotFound();
    }

    public function test_wallet_topup_increases_balance_and_adds_transaction(): void
    {
        $wallet = Wallet::firstOrFail(); // seeded balance 580, 3 transactions
        $originalBalance = (float) $wallet->balance;

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/wallets/{$wallet->id}/topup", [
                'amount' => 200,
                'label' => 'เติมทดสอบ',
            ])
            ->assertOk()
            // JSON encodes whole floats without a trailing .0, so compare loosely.
            ->assertJsonPath('data.balance', fn ($v) => (float) $v === $originalBalance + 200)
            ->assertJsonPath('data.transactionCount', 4);

        $this->assertEquals($originalBalance + 200, (float) $wallet->fresh()->balance);
        $this->assertDatabaseHas('wallet_transactions', [
            'wallet_id' => $wallet->id,
            'label' => 'เติมทดสอบ',
            'amount' => 200,
        ]);
    }

    public function test_wallet_topup_rejects_non_positive_amount(): void
    {
        $wallet = Wallet::firstOrFail();

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/wallets/{$wallet->id}/topup", ['amount' => 0])
            ->assertStatus(422);
    }

    public function test_mutations_require_staff(): void
    {
        $customer = $this->customerToken();
        $membership = Membership::firstOrFail();
        $wallet = Wallet::firstOrFail();
        $roleId = $this->managerRoleId();

        $this->withToken($customer)->postJson('/api/v1/owner/staff', [
            'email' => 'x@everyday.test',
            'displayName' => 'X',
            'roleId' => $roleId,
        ])->assertForbidden();

        $this->app['auth']->forgetGuards();
        $this->withToken($customer)
            ->postJson("/api/v1/owner/memberships/{$membership->id}/points", ['delta' => 10])
            ->assertForbidden();

        $this->app['auth']->forgetGuards();
        $this->withToken($customer)
            ->postJson("/api/v1/owner/wallets/{$wallet->id}/topup", ['amount' => 100])
            ->assertForbidden();
    }
}
