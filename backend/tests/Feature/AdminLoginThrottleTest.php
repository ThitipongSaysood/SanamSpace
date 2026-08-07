<?php

namespace Tests\Feature;

use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * /auth/admin/login rate limiting (#6): owner + super-admin credentials were
 * open to unlimited password guessing. The limiter counts only FAILED attempts,
 * keyed by email+IP, so a real user is never locked out by logging in normally.
 */
class AdminLoginThrottleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function attempt(string $password): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => $password,
        ]);
    }

    public function test_six_wrong_passwords_earn_a_429(): void
    {
        // Five wrong guesses are ordinary invalid-credential 422s.
        for ($i = 0; $i < 5; $i++) {
            $this->attempt('wrong')->assertStatus(422);
        }

        // The sixth is locked out.
        $this->attempt('wrong')->assertStatus(429);

        // The lock stands even if the correct password is now offered.
        $this->attempt('password')->assertStatus(429);
    }

    public function test_a_successful_login_clears_the_counter(): void
    {
        // A few failures short of the limit…
        $this->attempt('wrong')->assertStatus(422);
        $this->attempt('wrong')->assertStatus(422);

        // …then a correct login succeeds and resets the count.
        $this->attempt('password')->assertOk()->assertJsonStructure(['token']);

        // Because the counter was cleared, more attempts are available again —
        // a legitimate user is never locked out by their own valid logins.
        $this->attempt('wrong')->assertStatus(422);
        $this->attempt('wrong')->assertStatus(422);
        $this->attempt('wrong')->assertStatus(422);
        $this->attempt('wrong')->assertStatus(422);
        $this->attempt('password')->assertOk();
    }
}
