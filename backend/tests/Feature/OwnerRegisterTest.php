<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Plan;
use App\Models\User;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Self-serve signup: the landing "ทดลองใช้ฟรี 30 วัน" button must actually open a
 * venue the new owner can log in to — the gap that made the trial offer a dead
 * anchor + an owner who could never sign in.
 */
class OwnerRegisterTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private array $payload = [
        'venueName' => 'Sunrise Badminton',
        'ownerName' => 'สมชาย ใจดี',
        'email' => 'owner@sunrise.test',
        'password' => 'secret1234',
        'password_confirmation' => 'secret1234',
        'planCode' => 'business',
    ];

    public function test_signup_creates_a_venue_owner_and_trial_the_owner_can_log_in_to(): void
    {
        $res = $this->postJson('/api/v1/auth/owner/register', $this->payload)
            ->assertCreated()
            ->assertJsonStructure(['token', 'user' => ['id', 'email']]);

        $org = Organization::where('slug', 'sunrise-badminton')->firstOrFail();
        $this->assertNotNull($org->trial_start_at, 'trial must be recorded, not just an ends_at');
        $this->assertNotNull($org->trial_end_at);
        $this->assertSame('business', $org->activeSubscription?->plan?->code);

        // The owner user exists with the owner role membership.
        $user = User::where('email', 'owner@sunrise.test')->firstOrFail();
        $this->assertDatabaseHas('organization_users', [
            'organization_id' => $org->id,
            'user_id' => $user->id,
            'status' => 'active',
        ]);

        // The whole point of #2: the password THEY chose actually logs in.
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@sunrise.test',
            'password' => 'secret1234',
        ])->assertOk()->assertJsonStructure(['token']);

        // And the signup already returned a usable token.
        $this->assertNotEmpty($res->json('token'));
    }

    public function test_signup_defaults_to_the_full_pro_trial_when_no_plan_is_chosen(): void
    {
        $payload = $this->payload;
        unset($payload['planCode']);

        $this->postJson('/api/v1/auth/owner/register', $payload)->assertCreated();

        $org = Organization::where('slug', 'sunrise-badminton')->firstOrFail();
        $this->assertSame('pro', $org->activeSubscription?->plan?->code);
    }

    public function test_signup_rejects_an_email_that_already_has_an_account(): void
    {
        User::factory()->create(['email' => 'taken@sunrise.test']);

        $this->postJson('/api/v1/auth/owner/register', [...$this->payload, 'email' => 'taken@sunrise.test'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');

        // No half-made venue left behind on the rejected signup.
        $this->assertDatabaseMissing('organizations', ['slug' => 'sunrise-badminton']);
    }

    public function test_signup_requires_a_matching_eight_char_password(): void
    {
        $this->postJson('/api/v1/auth/owner/register', [...$this->payload, 'password' => 'short', 'password_confirmation' => 'short'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('password');
    }

    public function test_an_admin_created_venue_is_recorded_as_a_trial(): void
    {
        $token = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'super@sanamspace.test', 'password' => 'password',
        ])->json('token');

        $planId = Plan::where('code', 'business')->value('id');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson('/api/v1/admin/organizations', [
            'name' => 'Adminmade Arena',
            'ownerName' => 'เจ้าของ',
            'email' => 'adminmade@arena.test',
            'planId' => $planId,
        ])->assertCreated();

        $org = Organization::where('slug', 'adminmade-arena')->firstOrFail();
        $this->assertNotNull($org->trial_start_at, 'admin-created venue with a plan should be a recorded trial');
    }
}
