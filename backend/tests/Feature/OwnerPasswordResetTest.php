<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

/**
 * Getting back into an owner account.
 *
 * There was no way at all. A venue created from the admin screen was given
 * `Str::random(24)` as its password, which was sent nowhere, and the system had
 * no reset, no invite and no "forgot password" — so the platform could onboard
 * a paying customer who then simply could not log in, with nothing on any
 * screen explaining why. This is the whole of that gap, closed with one
 * mechanism and two doors: the owner asks, or the admin sends.
 */
class OwnerPasswordResetTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function adminToken(): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'super@sanamspace.test',
            'password' => 'password',
        ])->json('token');
    }

    /** Laravel caches the resolved guard user between calls inside one test. */
    private function as(string $token): self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    private function owner(): User
    {
        return User::where('email', 'owner@everyday.test')->firstOrFail();
    }

    // ---- the owner asks -----------------------------------------------------

    public function test_an_owner_can_ask_for_a_link_and_use_it(): void
    {
        Notification::fake();

        $this->postJson('/api/v1/auth/owner/forgot-password', ['email' => 'owner@everyday.test'])
            ->assertOk();

        $token = null;
        Notification::assertSentTo($this->owner(), ResetPassword::class, function ($n) use (&$token) {
            $token = $n->token;

            return true;
        });

        $this->postJson('/api/v1/auth/owner/reset-password', [
            'token' => $token,
            'email' => 'owner@everyday.test',
            'password' => 'a-brand-new-password',
            'password_confirmation' => 'a-brand-new-password',
        ])->assertOk();

        $this->assertTrue(Hash::check('a-brand-new-password', $this->owner()->fresh()->password));

        // …and the new password is what actually gets them in.
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'a-brand-new-password',
        ])->assertOk()->assertJsonStructure(['token']);
    }

    /**
     * The answer is the same whether or not the address is on file.
     *
     * Telling a stranger which emails have accounts is telling them which ones
     * are worth attacking.
     */
    public function test_an_unknown_email_gets_the_same_answer(): void
    {
        Notification::fake();

        $known = $this->postJson('/api/v1/auth/owner/forgot-password', ['email' => 'owner@everyday.test']);
        $this->postJson('/api/v1/auth/owner/forgot-password', ['email' => 'nobody@nowhere.test'])
            ->assertOk()
            ->assertExactJson($known->json());

        Notification::assertSentToTimes($this->owner(), ResetPassword::class, 1);
    }

    public function test_a_link_cannot_be_spent_twice(): void
    {
        Notification::fake();
        $this->postJson('/api/v1/auth/owner/forgot-password', ['email' => 'owner@everyday.test']);

        $token = null;
        Notification::assertSentTo($this->owner(), ResetPassword::class, function ($n) use (&$token) {
            $token = $n->token;

            return true;
        });

        $body = [
            'token' => $token,
            'email' => 'owner@everyday.test',
            'password' => 'first-new-password',
            'password_confirmation' => 'first-new-password',
        ];

        $this->postJson('/api/v1/auth/owner/reset-password', $body)->assertOk();

        $this->postJson('/api/v1/auth/owner/reset-password', array_merge($body, [
            'password' => 'second-new-password',
            'password_confirmation' => 'second-new-password',
        ]))->assertStatus(422)->assertJsonValidationErrors('token');
    }

    public function test_a_made_up_token_is_refused(): void
    {
        $this->postJson('/api/v1/auth/owner/reset-password', [
            'token' => 'not-a-real-token',
            'email' => 'owner@everyday.test',
            'password' => 'whatever-i-like',
            'password_confirmation' => 'whatever-i-like',
        ])->assertStatus(422)->assertJsonValidationErrors('token');
    }

    /**
     * A reset ends every session, not just this one.
     *
     * Someone resetting a password believes the account may not be only theirs;
     * leaving the old tokens alive would keep whoever else holds one signed in.
     */
    public function test_resetting_revokes_the_sessions_that_were_already_open(): void
    {
        Notification::fake();

        $existing = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');

        $this->as($existing)->getJson('/api/v1/auth/me')->assertOk();

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/owner/forgot-password', ['email' => 'owner@everyday.test']);

        $token = null;
        Notification::assertSentTo($this->owner(), ResetPassword::class, function ($n) use (&$token) {
            $token = $n->token;

            return true;
        });

        $this->postJson('/api/v1/auth/owner/reset-password', [
            'token' => $token,
            'email' => 'owner@everyday.test',
            'password' => 'rotated-password',
            'password_confirmation' => 'rotated-password',
        ])->assertOk();

        $this->as($existing)->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    // ---- the admin sends ----------------------------------------------------

    /**
     * The venue the admin just created can be opened by the person it was
     * created for — which was not true before.
     */
    public function test_an_admin_created_venue_owner_can_be_sent_a_link(): void
    {
        Notification::fake();

        $created = $this->as($this->adminToken())->postJson('/api/v1/admin/organizations', [
            'name' => 'สนามใหม่เอี่ยม',
            'ownerName' => 'คุณเจ้าของใหม่',
            'email' => 'brand-new-owner@venue.test',
        ])->assertCreated()->json('data.id');

        $this->as($this->adminToken())
            ->postJson("/api/v1/admin/organizations/{$created}/owner/reset-link")
            ->assertOk()
            ->assertJsonPath('email', 'brand-new-owner@venue.test');

        $owner = User::where('email', 'brand-new-owner@venue.test')->firstOrFail();
        Notification::assertSentTo($owner, ResetPassword::class);

        $this->assertDatabaseHas('audit_logs', ['action' => 'ส่งลิงก์ตั้งรหัสผ่านให้เจ้าของสนาม']);
    }

    public function test_only_the_platform_may_send_that_link(): void
    {
        Notification::fake();

        $ownerToken = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');

        $this->as($ownerToken)
            ->postJson('/api/v1/admin/organizations/tsr-arena/owner/reset-link')
            ->assertForbidden();

        Notification::assertNothingSent();
    }

    // ---- where the link points ----------------------------------------------

    /**
     * At the portal, not the API.
     *
     * Laravel builds the link from `APP_URL`, which here is the Laravel app —
     * an owner following it would land on a JSON 404.
     */
    public function test_the_link_points_at_the_owner_portal(): void
    {
        config(['app.frontend_url' => 'https://app.example.test']);

        $url = null;
        Notification::fake();
        $this->postJson('/api/v1/auth/owner/forgot-password', ['email' => 'owner@everyday.test']);

        Notification::assertSentTo($this->owner(), ResetPassword::class, function (ResetPassword $n) use (&$url) {
            $url = $n->toMail($this->owner())->actionUrl;

            return true;
        });

        $this->assertStringStartsWith('https://app.example.test/owner/reset-password?token=', (string) $url);
        $this->assertStringContainsString('email=owner%40everyday.test', (string) $url);
    }

    public function test_the_reset_endpoints_are_rate_limited(): void
    {
        Notification::fake();

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/owner/forgot-password', ['email' => 'owner@everyday.test'])->assertOk();
        }

        $this->postJson('/api/v1/auth/owner/forgot-password', ['email' => 'owner@everyday.test'])
            ->assertStatus(429);
    }

    public function test_a_short_password_is_refused(): void
    {
        $this->postJson('/api/v1/auth/owner/reset-password', [
            'token' => 'anything',
            'email' => 'owner@everyday.test',
            'password' => 'short',
            'password_confirmation' => 'short',
        ])->assertStatus(422)->assertJsonValidationErrors('password');
    }

    /**
     * The baseline API ceiling must not resolve who is signed in.
     *
     * The limiter runs before the route's own middleware, so asking it for
     * `$request->user()` caches a guard identity the rest of the request
     * inherits — four multi-actor tests turned 403 the moment it was written
     * that way. Two different tokens must get two different buckets without
     * that ever happening.
     */
    public function test_the_baseline_throttle_separates_callers_without_touching_the_guard(): void
    {
        $admin = $this->adminToken();
        $owner = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');

        // Whoever asks last is still themselves — the identity is not carried
        // over from the previous caller.
        $this->as($admin)->getJson('/api/v1/auth/me')->assertOk()
            ->assertJsonPath('data.email', 'super@sanamspace.test');

        $this->as($owner)->getJson('/api/v1/auth/me')->assertOk()
            ->assertJsonPath('data.email', 'owner@everyday.test');

        $this->as($admin)->getJson('/api/v1/admin/organizations')->assertOk();
    }

    public function test_the_seeded_venue_still_has_an_owner_to_reset(): void
    {
        $org = Organization::where('slug', 'everyday-badminton')->firstOrFail();

        $this->assertNotNull($org->organizationUsers()->with('user')->first()?->user?->email);
    }
}
