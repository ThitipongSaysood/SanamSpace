<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Platform users: adding a teammate, and taking their access away without
 * erasing them from the records they touched.
 */
class AdminUserManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function adminToken(string $email = 'super@sanamspace.test'): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => $email,
            'password' => 'password',
        ])->json('token');
    }

    /** Laravel caches the resolved guard user between calls inside one test. */
    private function as(string $token): self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    public function test_admin_can_create_a_platform_user_who_can_then_sign_in(): void
    {
        $this->as($this->adminToken())->postJson('/api/v1/admin/users', [
            'name' => 'ทีมงานใหม่',
            'email' => 'new-admin@sanamspace.test',
            'password' => 'secret-password',
        ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'ทีมงานใหม่')
            ->assertJsonPath('data.status', 'active');

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'new-admin@sanamspace.test',
            'password' => 'secret-password',
        ])->assertOk()->assertJsonStructure(['token']);
    }

    public function test_creating_a_user_rejects_a_duplicate_email(): void
    {
        $this->as($this->adminToken())->postJson('/api/v1/admin/users', [
            'name' => 'ซ้ำ',
            'email' => 'super@sanamspace.test',
            'password' => 'secret-password',
        ])->assertStatus(422)->assertJsonValidationErrors('email');
    }

    /** The point of suspending: the record stays, the access does not. */
    public function test_suspending_blocks_sign_in_but_keeps_the_account(): void
    {
        $token = $this->adminToken();
        $id = $this->as($token)->postJson('/api/v1/admin/users', [
            'name' => 'จะโดนระงับ',
            'email' => 'leaving@sanamspace.test',
            'password' => 'secret-password',
        ])->json('data.id');

        $this->as($token)->postJson("/api/v1/admin/users/{$id}/suspend")
            ->assertOk()
            ->assertJsonPath('data.status', 'suspended');

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'leaving@sanamspace.test',
            'password' => 'secret-password',
        ])->assertStatus(422);

        // Still listed, so past approvals keep a name against them.
        $this->as($token)->getJson('/api/v1/admin/users')
            ->assertOk()
            ->assertJsonFragment(['email' => 'leaving@sanamspace.test']);

        $this->as($token)->postJson("/api/v1/admin/users/{$id}/activate")
            ->assertOk()
            ->assertJsonPath('data.status', 'active');

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'leaving@sanamspace.test',
            'password' => 'secret-password',
        ])->assertOk();
    }

    /** A token issued before the suspension must stop working too. */
    public function test_suspending_revokes_the_tokens_that_person_is_already_holding(): void
    {
        $adminToken = $this->adminToken();
        $id = $this->as($adminToken)->postJson('/api/v1/admin/users', [
            'name' => 'ถือ token อยู่',
            'email' => 'holder@sanamspace.test',
            'password' => 'secret-password',
        ])->json('data.id');

        $this->app['auth']->forgetGuards();
        $theirToken = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'holder@sanamspace.test',
            'password' => 'secret-password',
        ])->json('token');

        $this->as($theirToken)->getJson('/api/v1/admin/users')->assertOk();

        $this->as($adminToken)->postJson("/api/v1/admin/users/{$id}/suspend")->assertOk();

        $this->as($theirToken)->getJson('/api/v1/admin/users')->assertUnauthorized();
    }

    /** Two one-way doors the UI must not open. */
    public function test_an_admin_cannot_suspend_themselves(): void
    {
        $me = User::where('email', 'super@sanamspace.test')->firstOrFail();

        $this->as($this->adminToken())->postJson("/api/v1/admin/users/{$me->id}/suspend")
            ->assertStatus(422);

        $this->assertSame('active', $me->fresh()->status);
    }

    public function test_the_last_active_admin_cannot_be_suspended(): void
    {
        $token = $this->adminToken();

        // A second admin, so the seeded one is not the only account — then
        // suspend the second, leaving exactly one.
        $id = $this->as($token)->postJson('/api/v1/admin/users', [
            'name' => 'คนที่สอง',
            'email' => 'second@sanamspace.test',
            'password' => 'secret-password',
        ])->json('data.id');

        $this->as($token)->postJson("/api/v1/admin/users/{$id}/suspend")->assertOk();

        // Now only the caller is left, and they cannot be removed by anyone.
        $me = User::where('email', 'super@sanamspace.test')->firstOrFail();
        $this->as($token)->postJson("/api/v1/admin/users/{$me->id}/suspend")->assertStatus(422);

        $this->assertSame('active', $me->fresh()->status);
    }

    public function test_updating_a_user_leaves_the_password_alone_when_blank(): void
    {
        $token = $this->adminToken();
        $id = $this->as($token)->postJson('/api/v1/admin/users', [
            'name' => 'แก้ชื่อ',
            'email' => 'rename@sanamspace.test',
            'password' => 'secret-password',
        ])->json('data.id');

        $this->as($token)->putJson("/api/v1/admin/users/{$id}", [
            'name' => 'ชื่อใหม่',
            'password' => null,
        ])
            ->assertOk()
            ->assertJsonPath('data.name', 'ชื่อใหม่');

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'rename@sanamspace.test',
            'password' => 'secret-password',
        ])->assertOk();
    }
}
