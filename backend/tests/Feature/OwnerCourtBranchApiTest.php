<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Organization;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Owner Portal — manage branches (สนาม) and courts (คอร์ท): add / edit / delete /
 * toggle (เปิด-ปิด). All org-scoped via owner.org; isolation enforced.
 */
class OwnerCourtBranchApiTest extends TestCase
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

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    private function otherOrgBranch(): Branch
    {
        $other = Organization::where('id', '!=', $this->org()->id)->first()
            ?? Organization::create(['name' => 'Other Org', 'slug' => 'other-org']);

        return Branch::where('organization_id', $other->id)->first()
            ?? Branch::create(['organization_id' => $other->id, 'name' => 'Other Branch', 'status' => 'active']);
    }

    public function test_owner_can_create_list_update_toggle_delete_a_branch(): void
    {
        $token = $this->ownerToken();

        $id = $this->withToken($token)->postJson('/api/v1/owner/branches', [
            'name' => 'สาขาใหม่',
            'address' => '99 ถ.ใหม่',
            'phone' => '02-111-2222',
            'openTime' => '08:00',
            'closeTime' => '22:00',
            'sports' => ['badminton'],
        ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'สาขาใหม่')
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.openTime', '08:00')
            ->assertJsonPath('data.courtCount', 0)
            ->json('data.id');

        $this->assertDatabaseHas('branches', [
            'id' => $id,
            'organization_id' => $this->org()->id,
            'name' => 'สาขาใหม่',
        ]);

        $this->withToken($token)->getJson('/api/v1/owner/branches')
            ->assertOk()
            ->assertJsonFragment(['id' => $id]);

        $this->withToken($token)->putJson("/api/v1/owner/branches/$id", ['name' => 'สาขาแก้ไข'])
            ->assertOk()
            ->assertJsonPath('data.name', 'สาขาแก้ไข');

        $this->withToken($token)->postJson("/api/v1/owner/branches/$id/toggle")
            ->assertOk()
            ->assertJsonPath('data.status', 'inactive');

        $this->withToken($token)->deleteJson("/api/v1/owner/branches/$id")
            ->assertNoContent();
        $this->assertSoftDeleted('branches', ['id' => $id]);
    }

    public function test_owner_can_create_update_toggle_delete_a_court(): void
    {
        $token = $this->ownerToken();
        $branchId = Branch::where('organization_id', $this->org()->id)->firstOrFail()->id;

        $id = $this->withToken($token)->postJson('/api/v1/owner/courts', [
            'branchId' => $branchId,
            'name' => 'คอร์ทใหม่',
            'sport' => 'badminton',
            'pricePerHour' => 250,
            'floor' => 'ยาง',
        ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'คอร์ทใหม่')
            ->assertJsonPath('data.pricePerHour', 250)
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.spec.floor', 'ยาง')
            ->json('data.id');

        $this->withToken($token)->putJson("/api/v1/owner/courts/$id", ['pricePerHour' => 300])
            ->assertOk()
            ->assertJsonPath('data.pricePerHour', 300);

        $this->withToken($token)->postJson("/api/v1/owner/courts/$id/toggle")
            ->assertOk()
            ->assertJsonPath('data.status', 'inactive');

        $this->withToken($token)->deleteJson("/api/v1/owner/courts/$id")
            ->assertNoContent();
        $this->assertSoftDeleted('courts', ['id' => $id]);
    }

    public function test_court_cannot_attach_to_another_orgs_branch(): void
    {
        $this->withToken($this->ownerToken())->postJson('/api/v1/owner/courts', [
            'branchId' => $this->otherOrgBranch()->id,
            'name' => 'x',
            'sport' => 'badminton',
            'pricePerHour' => 100,
        ])->assertStatus(422);
    }

    public function test_cannot_update_another_orgs_branch(): void
    {
        $this->withToken($this->ownerToken())
            ->putJson("/api/v1/owner/branches/{$this->otherOrgBranch()->id}", ['name' => 'hack'])
            ->assertNotFound();
    }

    public function test_super_admin_without_org_is_forbidden(): void
    {
        $token = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'super@sanamspace.test',
            'password' => 'password',
        ])->json('token');

        $this->withToken($token)->getJson('/api/v1/owner/branches')->assertForbidden();
        $this->withToken($token)->postJson('/api/v1/owner/courts', [])->assertForbidden();
    }
}
