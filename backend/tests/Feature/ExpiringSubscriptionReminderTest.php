<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Organization;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Warning a venue before it is locked out.
 *
 * The portal answers 402 the moment the subscription lapses, and until this
 * ran nothing said anything beforehand — a venue found out mid-shift.
 */
class ExpiringSubscriptionReminderTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
        Mail::fake();
    }

    private function endsIn(int $days): Organization
    {
        $org = Organization::where('slug', 'everyday-badminton')->firstOrFail();
        $org->activeSubscription->update(['ends_at' => now()->addDays($days)]);

        // Everything else must stay quiet, or one venue's warning becomes two.
        Organization::where('id', '!=', $org->id)->each(
            fn ($other) => $other->activeSubscription?->update(['ends_at' => now()->addYear()]),
        );

        return $org;
    }

    public function test_it_warns_a_week_out(): void
    {
        $this->endsIn(7);

        $this->artisan('subscriptions:remind-expiring')
            ->expectsOutputToContain('warned 1 venue(s)')
            ->assertSuccessful();
    }

    /**
     * The whole design rests on this: exact-day matching is what stops a daily
     * command from mailing the same venue every morning for a week, which is
     * how a warning turns into something people filter out.
     */
    public function test_it_says_nothing_on_the_days_between(): void
    {
        $this->endsIn(5);

        $this->artisan('subscriptions:remind-expiring')
            ->expectsOutputToContain('warned 0 venue(s)')
            ->assertSuccessful();
    }

    public function test_it_says_nothing_once_the_plan_has_already_lapsed(): void
    {
        $this->endsIn(-3);

        // Past that point the portal itself is telling them, on every screen.
        $this->artisan('subscriptions:remind-expiring')
            ->expectsOutputToContain('warned 0 venue(s)')
            ->assertSuccessful();
    }

    public function test_a_suspended_venue_is_left_alone(): void
    {
        $this->endsIn(3)->update(['status' => 'suspended']);

        $this->artisan('subscriptions:remind-expiring')
            ->expectsOutputToContain('warned 0 venue(s)')
            ->assertSuccessful();
    }

    /**
     * `overdue` was in the schema and in every query that reads outstanding
     * invoices, and nothing ever set it — so a bill three weeks late looked
     * exactly like one raised this morning.
     */
    public function test_it_ages_invoices_past_their_due_date(): void
    {
        $org = $this->endsIn(30);

        $late = Invoice::create([
            'number' => 'INV-TEST-0001',
            'organization_id' => $org->id,
            'organization_name' => $org->name,
            'amount' => 3990,
            'status' => 'unpaid',
            'issue_date' => now()->subDays(30)->toDateString(),
            'due_date' => now()->subDays(23)->toDateString(),
        ]);

        $fresh = Invoice::create([
            'number' => 'INV-TEST-0002',
            'organization_id' => $org->id,
            'organization_name' => $org->name,
            'amount' => 3990,
            'status' => 'unpaid',
            'issue_date' => now()->toDateString(),
            'due_date' => now()->addDays(7)->toDateString(),
        ]);

        $this->artisan('subscriptions:remind-expiring')->assertSuccessful();

        $this->assertSame('overdue', $late->fresh()->status);
        $this->assertSame('unpaid', $fresh->fresh()->status);
    }
}
