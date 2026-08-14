<?php

namespace Tests\Feature;

use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * /auth/line/login rate limiting: the endpoint is unauthenticated and every
 * call upserts a customer and mints a token, so an unthrottled version is a
 * mass account/token mint (and, in real mode, an amplifier for the external
 * LINE verify API). Limited by IP, 20/minute.
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

    private function attempt(): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => 'Uthrottle',
            'displayName' => 'Throttle Tester',
        ]);
    }

    public function test_line_login_is_rate_limited_by_ip(): void
    {
        // Twenty logins a minute are allowed — each returns a usable token.
        for ($i = 0; $i < 20; $i++) {
            $this->attempt()->assertSuccessful()->assertJsonStructure(['token']);
        }

        // The twenty-first from the same IP is locked out.
        $this->attempt()->assertStatus(429);
    }
}
