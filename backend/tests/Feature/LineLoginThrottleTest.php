<?php

namespace Tests\Feature;

use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * /auth/line/login rate limiting: the endpoint is unauthenticated and every
 * call upserts a customer and mints a token, so an unthrottled version is a
 * mass account/token mint (and, in real mode, an amplifier for the external
 * LINE verify API).
 *
 * Limited on TWO keys, because one number cannot serve both jobs. A venue's
 * customers all arrive through one address — thirty people on the hall's wifi
 * are one IP — so the per-IP limit that was here at 20/minute did not stop an
 * attacker with a phone, it stopped a Saturday. The identity carries the tight
 * limit now (10/min: one LINE account signing in ten times a minute is not a
 * person) and the address carries a loose one only a script can reach.
 *
 * Deliberately limited INSIDE the controller, not with route `throttle`
 * middleware: that middleware resolves $request->user() to key the limiter and
 * re-caches a leftover bearer identity on the guard, which breaks the
 * multi-actor flow (a customer request would authenticate as a leftover owner).
 * This test guards both the limit and that the login still authenticates as the
 * customer it mints.
 */
class LineLoginThrottleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function attempt(string $lineUserId = 'Uthrottle'): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => $lineUserId,
            'displayName' => 'Throttle Tester',
        ]);
    }

    public function test_one_line_account_cannot_sign_in_over_and_over(): void
    {
        // Ten a minute for one identity — each returns a usable token.
        for ($i = 0; $i < 10; $i++) {
            $this->attempt()->assertSuccessful()->assertJsonStructure(['token']);
        }

        // The eleventh for that same account is locked out.
        $this->attempt()->assertStatus(429);
    }

    /**
     * A room full of people is not an attack.
     *
     * This is the case the old single per-IP limit got wrong: twenty different
     * customers arriving together at one venue share its wifi, and the
     * twenty-first was refused. Every one of them is a different LINE account,
     * so every one of them gets in.
     */
    public function test_a_venue_full_of_customers_on_one_wifi_all_get_in(): void
    {
        for ($i = 0; $i < 30; $i++) {
            $this->attempt("Ucustomer{$i}")->assertSuccessful()->assertJsonStructure(['token']);
        }
    }

    /** The address still carries a ceiling — it is just one only a script reaches. */
    public function test_the_address_still_has_a_ceiling(): void
    {
        for ($i = 0; $i < 120; $i++) {
            $this->attempt("Uflood{$i}")->assertSuccessful();
        }

        $this->attempt('Uflood-one-too-many')->assertStatus(429);
    }
}
