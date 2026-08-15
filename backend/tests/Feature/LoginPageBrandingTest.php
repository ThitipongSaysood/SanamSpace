<?php

namespace Tests\Feature;

use App\Models\Organization;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The venue's own sign-in page (/v/{slug}).
 *
 * Two fields, and the whole point of them is that they travel: an owner sets
 * them in their back office and a customer who has never signed in — and so
 * carries no token — must see them. That is two different endpoints, one
 * authenticated and one not, which is why this is tested as a round trip
 * rather than as two separate saves.
 */
class LoginPageBrandingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    /**
     * Send the next request as this token.
     *
     * `forgetGuards()` is not decoration: this test alternates between an
     * authenticated owner and a signed-out customer within one test, and a
     * guard that has already resolved a user keeps answering with it.
     */
    private function as(string $token): self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    private function login(string $email): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => $email,
            'password' => 'password',
        ])->json('token');
    }

    /** Drop the owner's bearer token, so the next call arrives as a stranger. */
    private function signedOut(): self
    {
        $this->app['auth']->forgetGuards();

        return $this->withHeaders(['Authorization' => '']);
    }

    public function test_what_the_owner_sets_is_what_a_signed_out_customer_sees(): void
    {
        $this->as($this->login('owner@everyday.test'))
            ->putJson('/api/v1/owner/settings', [
                'loginCoverUrl' => 'https://cdn.example.test/hall.jpg',
                'loginTagline' => "จองคอร์ทกับเรา\nว่างวันไหนดูได้เลย",
            ])
            ->assertOk()
            ->assertJsonPath('data.loginCoverUrl', 'https://cdn.example.test/hall.jpg');

        // No token on this call — this is the screen you reach before you have one.
        $this->signedOut()->getJson('/api/v1/orgs/everyday-badminton/public')
            ->assertOk()
            ->assertJsonPath('coverUrl', 'https://cdn.example.test/hall.jpg')
            ->assertJsonPath('tagline', "จองคอร์ทกับเรา\nว่างวันไหนดูได้เลย");
    }

    /**
     * Nothing set is the normal state, and it must arrive as null.
     *
     * The app treats null as "draw this venue's sport instead" and "write a
     * line from this venue's name". An empty string is not the same value: it
     * silences both fallbacks and leaves the screen blank.
     */
    public function test_a_venue_that_has_set_neither_gets_null_not_an_empty_string(): void
    {
        $res = $this->getJson('/api/v1/orgs/everyday-badminton/public')->assertOk();

        $this->assertNull($res->json('coverUrl'));
        $this->assertNull($res->json('tagline'));
    }

    /** Clearing them from the back office must reach the customer as null too. */
    public function test_clearing_them_restores_the_fallback(): void
    {
        $token = $this->login('owner@everyday.test');

        $this->as($token)->putJson('/api/v1/owner/settings', [
            'loginCoverUrl' => 'https://cdn.example.test/hall.jpg',
            'loginTagline' => 'มาเล่นกัน',
        ])->assertOk();

        $this->as($token)->putJson('/api/v1/owner/settings', [
            'loginCoverUrl' => null,
            'loginTagline' => '',
        ])->assertOk();

        $res = $this->getJson('/api/v1/orgs/everyday-badminton/public')->assertOk();

        $this->assertNull($res->json('coverUrl'));
        $this->assertNull($res->json('tagline'));
    }

    /** The design holds two lines on a phone; past that it is not a tagline. */
    public function test_an_over_long_tagline_is_refused(): void
    {
        $this->as($this->login('owner@everyday.test'))
            ->putJson('/api/v1/owner/settings', ['loginTagline' => str_repeat('ก', 161)])
            ->assertStatus(422)
            ->assertJsonValidationErrors('loginTagline');
    }

    /**
     * One venue's front door is not another's.
     *
     * Same field, same endpoint, different slug — the settings save is scoped
     * to the caller's own organization, so a second venue must be unaffected.
     */
    public function test_setting_one_venue_leaves_the_other_alone(): void
    {
        $other = Organization::where('slug', '!=', 'everyday-badminton')->first();

        if (! $other) {
            $this->markTestSkipped('the seed has a single venue');
        }

        $this->as($this->login('owner@everyday.test'))
            ->putJson('/api/v1/owner/settings', ['loginTagline' => 'ของสนามเรา'])
            ->assertOk();

        $this->assertNull(
            $this->getJson("/api/v1/orgs/{$other->slug}/public")->assertOk()->json('tagline'),
        );
    }

    /** A slug nobody owns still 404s rather than leaking a default. */
    public function test_an_unknown_venue_has_no_login_page(): void
    {
        $this->getJson('/api/v1/orgs/nope-not-real/public')->assertNotFound();
    }
}
