<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Subscription;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Ending a venue's plan is two different decisions.
 *
 * Cancel lets the paid period run out; suspend ends it now. The difference has
 * to be visible in whether the owner portal still opens.
 */
class AdminSubscriptionActionsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function as(string $token): self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    private function token(string $email): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => $email,
            'password' => 'password',
        ])->json('token');
    }

    private function subscription(): Subscription
    {
        $org = Organization::where('slug', 'everyday-badminton')->firstOrFail();
        $sub = Subscription::query()->forOrganization($org->id)->firstOrFail();
        // A comfortably future end date, so "still working" is unambiguous.
        $sub->update(['status' => 'active', 'ends_at' => now()->addMonths(3)]);

        return $sub->fresh();
    }

    /** Cancelled but still inside the paid period: the venue keeps working. */
    public function test_cancel_stops_the_renewal_without_locking_the_venue_out(): void
    {
        $sub = $this->subscription();

        $this->as($this->token('super@sanamspace.test'))
            ->postJson("/api/v1/admin/subscriptions/{$sub->id}/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');

        // ends_at untouched — they paid through the period.
        $this->assertTrue($sub->fresh()->ends_at->isFuture());

        $this->as($this->token('owner@everyday.test'))
            ->getJson('/api/v1/owner/dashboard')
            ->assertOk();
    }

    /** Suspend ends it now, and the owner portal closes immediately. */
    public function test_suspend_ends_the_plan_now_and_locks_the_owner_portal(): void
    {
        $sub = $this->subscription();

        $this->as($this->token('super@sanamspace.test'))
            ->postJson("/api/v1/admin/subscriptions/{$sub->id}/suspend")
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');

        $this->assertFalse($sub->fresh()->ends_at->isFuture());

        $this->as($this->token('owner@everyday.test'))
            ->getJson('/api/v1/owner/dashboard')
            ->assertStatus(402)
            ->assertJsonPath('code', 'subscription_expired');
    }

    /** Even suspended, the venue's own customers keep booking. */
    public function test_a_suspended_plan_does_not_stop_the_venue_s_customers(): void
    {
        $sub = $this->subscription();

        $this->as($this->token('super@sanamspace.test'))
            ->postJson("/api/v1/admin/subscriptions/{$sub->id}/suspend")
            ->assertOk();

        $this->app['auth']->forgetGuards();
        $customerToken = $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => 'Ususpendedplan',
            'displayName' => 'ลูกค้ายังจองได้',
        ])->json('token');

        $this->as($customerToken)->getJson('/api/v1/bookings')->assertOk();
    }

    /**
     * Resuming a plan that was suspended has to give it a future date, or the
     * venue stays locked out by the very action meant to let them back in.
     */
    public function test_resume_gives_an_expired_plan_a_future_date(): void
    {
        $sub = $this->subscription();
        $admin = $this->token('super@sanamspace.test');

        $this->as($admin)->postJson("/api/v1/admin/subscriptions/{$sub->id}/suspend")->assertOk();

        $this->as($admin)->postJson("/api/v1/admin/subscriptions/{$sub->id}/resume")
            ->assertOk()
            ->assertJsonPath('data.status', 'active');

        $this->assertTrue($sub->fresh()->ends_at->isFuture());

        $this->as($this->token('owner@everyday.test'))
            ->getJson('/api/v1/owner/dashboard')
            ->assertOk();
    }

    /** An explicit date wins over the fallback. */
    public function test_resume_accepts_an_end_date(): void
    {
        $sub = $this->subscription();
        $admin = $this->token('super@sanamspace.test');
        $target = now()->addYear()->startOfDay();

        $this->as($admin)->postJson("/api/v1/admin/subscriptions/{$sub->id}/suspend")->assertOk();
        $this->as($admin)->postJson("/api/v1/admin/subscriptions/{$sub->id}/resume", [
            'endsAt' => $target->toDateString(),
        ])->assertOk();

        $this->assertSame($target->toDateString(), $sub->fresh()->ends_at->toDateString());
    }

    /** Only the platform may do any of this. */
    public function test_a_venue_owner_cannot_cancel_their_own_plan(): void
    {
        $sub = $this->subscription();

        $this->as($this->token('owner@everyday.test'))
            ->postJson("/api/v1/admin/subscriptions/{$sub->id}/cancel")
            ->assertForbidden();
    }
}
