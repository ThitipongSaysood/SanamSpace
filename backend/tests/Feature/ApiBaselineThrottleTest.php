<?php

namespace Tests\Feature;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

/**
 * The ceiling the whole API sits under.
 *
 * Asserted by asking the limiter what it decides rather than by sending 1,200
 * requests: the interesting parts are WHAT it keys on and HOW HIGH it is, and
 * both are one function call away.
 *
 * The key matters more than the number. An earlier version keyed on
 * `$request->user()`, and because the limiter runs before the route's own
 * middleware, resolving the user there cached a guard identity that the rest of
 * the request inherited — four multi-actor tests turned 403 the moment it went
 * in. The same trap is already written up for login endpoints in the project
 * notes; this is the global version of it.
 */
class ApiBaselineThrottleTest extends TestCase
{
    private function limitFor(Request $request): Limit
    {
        $limiter = RateLimiter::limiter('api');
        $this->assertNotNull($limiter, 'the api limiter must be registered');

        return $limiter($request);
    }

    public function test_every_api_route_sits_under_the_baseline(): void
    {
        $kernel = app(Kernel::class);
        $groups = (new \ReflectionClass($kernel))->getProperty('middlewareGroups');
        $groups->setAccessible(true);

        $this->assertContains('throttle:api', $groups->getValue($kernel)['api'] ?? []);
    }

    /**
     * High enough that a room full of people never reaches it.
     *
     * Measured, not chosen: at 120/minute the e2e suite failed nine specs and
     * at 600 it still failed three, all of them on the shared bucket that every
     * request without a token uses. A venue's customers share one address —
     * thirty people on the hall's wifi are one IP — so a ceiling a busy
     * Saturday can reach is a ceiling that stops the venue taking bookings in
     * order to prevent nothing.
     */
    public function test_the_ceiling_is_far_above_a_busy_venue(): void
    {
        $this->assertSame(1200, $this->limitFor(Request::create('/api/v1/courts'))->maxAttempts);
    }

    public function test_two_signed_in_callers_do_not_share_a_bucket(): void
    {
        $a = Request::create('/api/v1/courts');
        $a->headers->set('Authorization', 'Bearer token-one');

        $b = Request::create('/api/v1/courts');
        $b->headers->set('Authorization', 'Bearer token-two');

        $this->assertNotSame($this->limitFor($a)->key, $this->limitFor($b)->key);
    }

    /** With no token there is nothing else to go on — but it must not be blank. */
    public function test_an_anonymous_caller_is_keyed_by_address(): void
    {
        $key = $this->limitFor(Request::create('/api/v1/courts'))->key;

        $this->assertStringStartsWith('ip:', $key);
        $this->assertNotSame('ip:', $key);
    }

    /**
     * The token is never stored in the cache key as given.
     *
     * Rate-limit keys end up in the cache store, in logs and in exception
     * context; a bearer token is a credential and does not belong in any of
     * them.
     */
    public function test_the_token_is_hashed_into_the_key_not_carried_in_it(): void
    {
        $request = Request::create('/api/v1/courts');
        $request->headers->set('Authorization', 'Bearer super-secret-token');

        $key = $this->limitFor($request)->key;

        $this->assertStringNotContainsString('super-secret-token', $key);
        $this->assertStringStartsWith('tok:', $key);
    }

    /**
     * Resolving who is signed in here is the mistake this guards against.
     *
     * `Request::user()` on a bare request would have to hit the guard; the
     * limiter must decide without ever asking.
     */
    public function test_the_limiter_decides_without_resolving_the_user(): void
    {
        $request = Request::create('/api/v1/courts');
        $request->setUserResolver(function () {
            $this->fail('the api limiter must not resolve the authenticated user');
        });

        $this->assertSame(1200, $this->limitFor($request)->maxAttempts);
    }
}
