<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\Promotion;
use App\Models\Wallet;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Covers the Owner Portal "sections" endpoints (settings, promotions, staff,
 * roles, memberships, wallets). All are mounted under the auth:sanctum +
 * owner.org `/owner` group and are org-scoped to the authed staff user's org.
 */
class OwnerSectionsApiTest extends TestCase
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

    private function customerToken(string $lineUserId = 'Usections', string $name = 'Sections Cust'): string
    {
        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => $lineUserId,
            'displayName' => $name,
        ])->json('token');
    }

    public function test_get_settings_returns_org_settings(): void
    {
        $this->withToken($this->ownerToken())->getJson('/api/v1/owner/settings')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'orgName', 'orgSlug', 'logoText', 'phone', 'email', 'address',
                    'googleMapUrl', 'lineOaUrl', 'primaryColor',
                    'secondaryColor', 'accentColor', 'fontFamily', 'timezone',
                ],
            ])
            ->assertJsonPath('data.orgName', 'Everyday Badminton')
            // The owner portal builds the customer link (/v/{slug}) from this.
            ->assertJsonPath('data.orgSlug', 'everyday-badminton')
            ->assertJsonPath('data.primaryColor', '#16A34A')
            ->assertJsonPath('data.phone', '081-234-5678');
    }

    /** Renaming the venue must not move its customer link. */
    public function test_renaming_the_org_does_not_change_its_slug(): void
    {
        $this->withToken($this->ownerToken())
            ->putJson('/api/v1/owner/settings', ['orgName' => 'ชื่อใหม่เอี่ยม'])
            ->assertOk()
            ->assertJsonPath('data.orgName', 'ชื่อใหม่เอี่ยม')
            ->assertJsonPath('data.orgSlug', 'everyday-badminton');
    }

    public function test_put_settings_updates_fields_and_org_name(): void
    {
        $this->withToken($this->ownerToken())->putJson('/api/v1/owner/settings', [
            'phone' => '02-000-0000',
            'orgName' => 'Everyday Renamed',
            'primaryColor' => '#000000',
        ])
            ->assertOk()
            ->assertJsonPath('data.phone', '02-000-0000')
            ->assertJsonPath('data.orgName', 'Everyday Renamed')
            ->assertJsonPath('data.primaryColor', '#000000');

        $this->assertSame('Everyday Renamed', Organization::where('slug', 'everyday-badminton')->first()->name);
    }

    public function test_promotions_crud_flow(): void
    {
        $owner = $this->ownerToken();

        // List: seeded with 3.
        $this->withToken($owner)->getJson('/api/v1/owner/promotions')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonStructure(['data' => [['id', 'title', 'subtitle', 'tag', 'sortOrder']]]);

        // Create.
        $this->app['auth']->forgetGuards();
        $created = $this->withToken($owner)->postJson('/api/v1/owner/promotions', [
            'title' => 'ทดสอบ',
            'subtitle' => 'x',
            'tag' => 'ส่วนลด',
        ])
            ->assertCreated()
            ->assertJsonPath('data.title', 'ทดสอบ')
            ->assertJsonPath('data.sortOrder', 3);
        $id = $created->json('data.id');

        // Now 4 in the org.
        $this->app['auth']->forgetGuards();
        $this->withToken($owner)->getJson('/api/v1/owner/promotions')
            ->assertOk()->assertJsonCount(4, 'data');

        // Update.
        $this->app['auth']->forgetGuards();
        $this->withToken($owner)->putJson("/api/v1/owner/promotions/{$id}", [
            'title' => 'แก้ไขแล้ว',
        ])
            ->assertOk()
            ->assertJsonPath('data.title', 'แก้ไขแล้ว');

        // Delete.
        $this->app['auth']->forgetGuards();
        $this->withToken($owner)->deleteJson("/api/v1/owner/promotions/{$id}")
            ->assertNoContent();

        $this->app['auth']->forgetGuards();
        $this->withToken($owner)->getJson('/api/v1/owner/promotions')
            ->assertOk()->assertJsonCount(3, 'data');
    }

    public function test_promotions_are_org_scoped(): void
    {
        $tsr = Organization::where('slug', 'tsr-arena')->firstOrFail();
        $tsrPromo = Promotion::create([
            'organization_id' => $tsr->id,
            'title' => 'TSR Only',
            'tag' => 'ส่วนลด',
            'sort_order' => 0,
        ]);

        $owner = $this->ownerToken(); // Everyday owner

        // Everyday owner sees only Everyday's 3 promotions.
        $this->withToken($owner)->getJson('/api/v1/owner/promotions')
            ->assertOk()->assertJsonCount(3, 'data');

        // Cross-org update / delete are 404.
        $this->app['auth']->forgetGuards();
        $this->withToken($owner)->putJson("/api/v1/owner/promotions/{$tsrPromo->id}", ['title' => 'hijack'])
            ->assertNotFound();

        $this->app['auth']->forgetGuards();
        $this->withToken($owner)->deleteJson("/api/v1/owner/promotions/{$tsrPromo->id}")
            ->assertNotFound();

        $this->assertSame('TSR Only', $tsrPromo->fresh()->title);
    }

    public function test_staff_list_returns_org_members(): void
    {
        $this->withToken($this->ownerToken())->getJson('/api/v1/owner/staff')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonStructure(['data' => [['id', 'displayName', 'email', 'roleName', 'status', 'joinedAt']]])
            ->assertJsonPath('data.0.email', 'owner@everyday.test')
            ->assertJsonPath('data.0.roleName', 'Owner')
            ->assertJsonPath('data.0.status', 'active');
    }

    public function test_roles_list_returns_available_roles(): void
    {
        $this->withToken($this->ownerToken())->getJson('/api/v1/owner/roles')
            ->assertOk()
            ->assertJsonCount(8, 'data')
            ->assertJsonStructure(['data' => [['id', 'name', 'isSystemRole']]])
            ->assertJsonPath('data.0.isSystemRole', true);
    }

    public function test_memberships_list_returns_org_memberships(): void
    {
        $this->withToken($this->ownerToken())->getJson('/api/v1/owner/memberships')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonStructure(['data' => [['id', 'customerName', 'tier', 'memberId', 'points', 'expiresAt']]])
            ->assertJsonPath('data.0.tier', 'Gold')
            ->assertJsonPath('data.0.customerName', 'คุณสมชาย');
    }

    public function test_wallets_list_returns_org_wallets(): void
    {
        $this->withToken($this->ownerToken())->getJson('/api/v1/owner/wallets')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonStructure(['data' => [['id', 'customerName', 'balance', 'transactionCount']]])
            ->assertJsonPath('data.0.balance', 580)
            ->assertJsonPath('data.0.transactionCount', 3)
            ->assertJsonPath('data.0.customerName', 'คุณสมชาย');
    }

    public function test_memberships_and_wallets_are_org_scoped(): void
    {
        // Give TSR a customer with a membership + wallet of its own.
        $tsr = Organization::where('slug', 'tsr-arena')->firstOrFail();
        $tsrCustomer = Customer::create([
            'organization_id' => $tsr->id,
            'line_user_id' => 'Utsrsections',
            'display_name' => 'TSR Cust',
        ]);
        Membership::create([
            'organization_id' => $tsr->id,
            'customer_id' => $tsrCustomer->id,
            'tier' => 'Silver',
            'member_id' => 'TSR-0001',
            'points' => 10,
            'expires_at' => '31 ธ.ค. 2567',
        ]);
        Wallet::create([
            'organization_id' => $tsr->id,
            'customer_id' => $tsrCustomer->id,
            'balance' => 999,
        ]);

        $owner = $this->ownerToken(); // Everyday owner

        $this->withToken($owner)->getJson('/api/v1/owner/memberships')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.tier', 'Gold');

        $this->app['auth']->forgetGuards();
        $this->withToken($owner)->getJson('/api/v1/owner/wallets')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.balance', 580);
    }

    public function test_section_endpoints_require_staff(): void
    {
        // A customer token (not a staff User) -> 403 on the owner.org gate.
        $customer = $this->customerToken();

        $this->withToken($customer)->getJson('/api/v1/owner/settings')
            ->assertForbidden();

        $this->app['auth']->forgetGuards();
        $this->withToken($customer)->getJson('/api/v1/owner/promotions')
            ->assertForbidden();

        $this->app['auth']->forgetGuards();
        $this->withToken($customer)->getJson('/api/v1/owner/staff')
            ->assertForbidden();
    }
}
