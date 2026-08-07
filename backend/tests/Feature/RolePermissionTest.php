<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Roles used to be decoration: the tables existed, the admin screen counted
 * them, and nothing read them — a "Viewer" could verify payments and delete
 * courts exactly like an Owner.
 *
 * These are the tests that keep that from being true again.
 */
class RolePermissionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function adminToken(): string
    {
        return $this->login('super@sanamspace.test');
    }

    private function login(string $email, string $password = 'password'): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => $email,
            'password' => $password,
        ])->json('token');
    }

    private function as(string $token): self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    /** A staff member at the seeded venue, carrying the given system role. */
    private function staffToken(string $roleCode): string
    {
        $org = Organization::where('slug', 'everyday-badminton')->firstOrFail();

        $user = User::create([
            'name' => "Staff {$roleCode}",
            'display_name' => "Staff {$roleCode}",
            'email' => "{$roleCode}@everyday.test",
            'password' => 'password',
        ]);

        OrganizationUser::create([
            'organization_id' => $org->id,
            'user_id' => $user->id,
            'role_id' => Role::where('code', $roleCode)->value('id'),
            'display_name' => $user->display_name,
            'status' => 'active',
            'joined_at' => now(),
        ]);

        return $this->login($user->email);
    }

    public function test_the_permission_catalogue_is_listed_for_the_editor(): void
    {
        $this->as($this->adminToken())->getJson('/api/v1/admin/permissions')
            ->assertOk()
            ->assertJsonStructure(['data' => [['id', 'code', 'name', 'module']]])
            ->assertJsonFragment(['code' => 'payment.verify']);
    }

    /** A cashier may take money, but must not be able to delete a court. */
    public function test_a_role_can_only_do_what_its_permissions_allow(): void
    {
        $cashier = $this->staffToken('cashier');

        $this->as($cashier)->getJson('/api/v1/owner/payments')->assertOk();

        $this->as($cashier)->postJson('/api/v1/owner/courts', [
            'branchId' => 'whatever',
            'name' => 'คอร์ทแอบสร้าง',
        ])
            ->assertForbidden()
            ->assertJsonPath('code', 'permission_denied');
    }

    /** Reading stays open; it is the actions that are gated. */
    public function test_a_viewer_can_read_but_not_write(): void
    {
        $viewer = $this->staffToken('viewer');

        $this->as($viewer)->getJson('/api/v1/owner/bookings')->assertOk();

        $this->as($viewer)->postJson('/api/v1/owner/promotions', [
            'title' => 'โปรของ viewer',
            'tag' => 'ส่วนลด',
        ])->assertForbidden();
    }

    /** The venue's owner must never be gated out of their own portal. */
    public function test_the_owner_role_passes_every_check(): void
    {
        $owner = $this->login('owner@everyday.test');

        $this->as($owner)->postJson('/api/v1/owner/promotions', [
            'title' => 'โปรของเจ้าของ',
            'tag' => 'ส่วนลด',
        ])->assertCreated();
    }

    /** Changing a role changes what its people can do, immediately. */
    public function test_granting_a_permission_opens_the_route_it_guards(): void
    {
        $cashier = $this->staffToken('cashier');

        $this->as($cashier)->postJson('/api/v1/owner/promotions', [
            'title' => 'ก่อนได้สิทธิ์',
            'tag' => 'ส่วนลด',
        ])->assertForbidden();

        $role = Role::where('code', 'cashier')->firstOrFail();
        $ids = $role->permissions->pluck('id')->push(
            Permission::where('code', 'promotion.manage')->value('id')
        )->all();

        $this->as($this->adminToken())->putJson("/api/v1/admin/roles/{$role->id}/permissions", [
            'permissionIds' => $ids,
        ])
            ->assertOk()
            ->assertJsonPath('data.permissionCount', count($ids));

        $this->as($cashier)->postJson('/api/v1/owner/promotions', [
            'title' => 'หลังได้สิทธิ์',
            'tag' => 'ส่วนลด',
        ])->assertCreated();
    }

    /** …and taking one away closes it again. */
    public function test_revoking_a_permission_closes_the_route(): void
    {
        $cashier = $this->staffToken('cashier');

        $this->as($cashier)->getJson('/api/v1/owner/payments')->assertOk();

        $role = Role::where('code', 'cashier')->firstOrFail();
        $keep = $role->permissions->where('code', '!=', 'payment.verify')->pluck('id')->all();

        $this->as($this->adminToken())->putJson("/api/v1/admin/roles/{$role->id}/permissions", [
            'permissionIds' => $keep,
        ])->assertOk();

        // The id does not need to exist: the permission check runs before the
        // controller, so a denied caller never reaches the lookup.
        $this->as($cashier)->postJson('/api/v1/owner/payments/any-id/verify')
            ->assertForbidden()
            ->assertJsonPath('code', 'permission_denied');
    }

    /** Roles that bypass the check must not offer an editable list. */
    public function test_owner_and_super_admin_roles_cannot_be_edited(): void
    {
        $token = $this->adminToken();

        foreach (['owner', 'super_admin'] as $code) {
            $role = Role::where('code', $code)->firstOrFail();

            $this->as($token)->putJson("/api/v1/admin/roles/{$role->id}/permissions", [
                'permissionIds' => [],
            ])->assertStatus(422);
        }

        $this->as($token)->getJson('/api/v1/admin/roles')
            ->assertOk()
            ->assertJsonFragment(['code' => 'owner', 'editable' => false])
            ->assertJsonFragment(['code' => 'cashier', 'editable' => true]);
    }

    /** A stale tab must not fail the whole save over a removed permission. */
    public function test_unknown_permission_ids_are_ignored_rather_than_rejected(): void
    {
        $role = Role::where('code', 'viewer')->firstOrFail();
        $real = Permission::where('code', 'booking.view')->value('id');

        $this->as($this->adminToken())->putJson("/api/v1/admin/roles/{$role->id}/permissions", [
            'permissionIds' => [$real, 'a-permission-that-no-longer-exists'],
        ])
            ->assertOk()
            ->assertJsonPath('data.permissionCount', 1);
    }

    /** Someone with no membership at the venue gets nothing. */
    public function test_a_user_who_is_not_staff_here_is_denied(): void
    {
        $stranger = User::create([
            'name' => 'คนนอก',
            'display_name' => 'คนนอก',
            'email' => 'stranger@nowhere.test',
            'password' => 'password',
        ]);

        $this->as($this->login($stranger->email))
            ->postJson('/api/v1/owner/promotions', ['title' => 'x', 'tag' => 'ส่วนลด'])
            ->assertForbidden();
    }
}
