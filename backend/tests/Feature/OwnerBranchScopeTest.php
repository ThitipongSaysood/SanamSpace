<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Branch;
use App\Models\Organization;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Looking at one branch, and looking at all of them.
 *
 * The owner portal was organization-scoped from end to end: a venue with three
 * branches got one dashboard covering all three and one booking list mixing
 * them together, with no way to ask "how did รังสิต do today". Absent
 * `branchId` still means exactly what it always did — every branch — so the
 * combined view is the same query it has always been, and these assertions pin
 * both halves.
 */
class OwnerBranchScopeTest extends TestCase
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

    private function login(string $email): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => $email,
            'password' => 'password',
        ])->json('token');
    }

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    /** The two seeded branches of the demo venue, in creation order. */
    private function branches(): array
    {
        return $this->org()->branches()->orderBy('created_at')->get()->all();
    }

    /**
     * A booking today at a given branch, so each branch has a number of its own.
     *
     * Confirmed, because the figures under test are the ones a venue actually
     * looks at: today's takings and today's count.
     */
    private function bookingToday(Branch $branch, float $amount): Booking
    {
        $court = $branch->courts()->firstOrFail();
        $today = \App\Support\VenueClock::now($this->org()->id)->toDateString();

        return Booking::create([
            'organization_id' => $this->org()->id,
            'branch_id' => $branch->id,
            'court_id' => $court->id,
            'customer_id' => $this->org()->customers()->firstOrFail()->id,
            'code' => 'BKSCOPE'.substr(md5($branch->id.$amount), 0, 6),
            'date' => $today,
            'start' => '08:00',
            'end' => '09:00',
            'amount' => $amount,
            'status' => 'confirmed',
            'channel' => 'walk_in',
        ]);
    }

    public function test_a_branch_dashboard_counts_only_that_branch(): void
    {
        [$first, $second] = $this->branches();
        $this->bookingToday($first, 300);
        $this->bookingToday($second, 500);

        $token = $this->login('owner@everyday.test');

        $one = $this->as($token)->getJson("/api/v1/owner/dashboard?branchId={$first->id}")->assertOk();
        $this->assertSame(300.0, (float) $one->json('todayRevenue'));
        $this->assertSame($first->id, $one->json('scope.branchId'));
        $this->assertSame($first->name, $one->json('scope.branchName'));

        $other = $this->as($token)->getJson("/api/v1/owner/dashboard?branchId={$second->id}")->assertOk();
        $this->assertSame(500.0, (float) $other->json('todayRevenue'));
    }

    /** No branchId is ทุกสาขา — and must equal the branches added up. */
    public function test_the_combined_dashboard_is_every_branch_together(): void
    {
        [$first, $second] = $this->branches();
        $this->bookingToday($first, 300);
        $this->bookingToday($second, 500);

        $token = $this->login('owner@everyday.test');
        $all = $this->as($token)->getJson('/api/v1/owner/dashboard')->assertOk();

        $this->assertSame(800.0, (float) $all->json('todayRevenue'));
        // Nothing selected, so nothing to say about a branch.
        $this->assertNull($all->json('scope.branchId'));
        $this->assertNull($all->json('scope.branchName'));
    }

    /** Courts are the denominator of utilisation, so they follow the scope too. */
    public function test_the_court_count_follows_the_branch(): void
    {
        [$first, $second] = $this->branches();
        $token = $this->login('owner@everyday.test');

        $a = (int) $this->as($token)->getJson("/api/v1/owner/dashboard?branchId={$first->id}")->json('courtCount');
        $b = (int) $this->as($token)->getJson("/api/v1/owner/dashboard?branchId={$second->id}")->json('courtCount');
        $all = (int) $this->as($token)->getJson('/api/v1/owner/dashboard')->json('courtCount');

        $this->assertGreaterThan(0, $a);
        $this->assertGreaterThan(0, $b);
        $this->assertSame($all, $a + $b);
    }

    public function test_the_booking_list_can_be_asked_for_one_branch(): void
    {
        [$first, $second] = $this->branches();
        $mine = $this->bookingToday($first, 300);
        $theirs = $this->bookingToday($second, 500);

        $token = $this->login('owner@everyday.test');
        $codes = collect(
            $this->as($token)->getJson("/api/v1/owner/bookings?branchId={$first->id}")->assertOk()->json('data')
        )->pluck('code');

        $this->assertTrue($codes->contains($mine->code));
        $this->assertFalse($codes->contains($theirs->code), 'a branch list must not carry another branch\'s bookings');
    }

    public function test_the_booking_list_without_a_branch_carries_them_all(): void
    {
        [$first, $second] = $this->branches();
        $mine = $this->bookingToday($first, 300);
        $theirs = $this->bookingToday($second, 500);

        $token = $this->login('owner@everyday.test');
        $codes = collect($this->as($token)->getJson('/api/v1/owner/bookings')->assertOk()->json('data'))->pluck('code');

        $this->assertTrue($codes->contains($mine->code));
        $this->assertTrue($codes->contains($theirs->code));
    }

    /**
     * Another venue's branch id is not a filter, it is a 404.
     *
     * Returning an empty result would be worse than an error: a venue would
     * read someone else's branch id as a quiet day of its own.
     */
    public function test_another_venues_branch_is_not_a_view_this_venue_can_ask_for(): void
    {
        $foreign = Branch::query()
            ->where('organization_id', '!=', $this->org()->id)
            ->firstOrFail();

        $token = $this->login('owner@everyday.test');

        $this->as($token)->getJson("/api/v1/owner/dashboard?branchId={$foreign->id}")->assertNotFound();
        $this->as($token)->getJson("/api/v1/owner/bookings?branchId={$foreign->id}")->assertNotFound();
    }

    /** A made-up id is refused the same way, rather than silently ignored. */
    public function test_a_branch_that_does_not_exist_is_refused(): void
    {
        $token = $this->login('owner@everyday.test');

        $this->as($token)->getJson('/api/v1/owner/dashboard?branchId=not-a-branch')->assertNotFound();
    }
}
