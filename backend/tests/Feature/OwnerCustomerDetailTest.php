<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Organization;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * One customer as the counter needs them: who they are, what they are worth,
 * and what they have booked — and never anyone else's venue's customer.
 */
class OwnerCustomerDetailTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function ownerToken(): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');
    }

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    public function test_it_returns_the_customer_with_their_standing_and_bookings(): void
    {
        $customer = Customer::query()->forOrganization($this->org()->id)->firstOrFail();

        $this->withToken($this->ownerToken())
            ->getJson("/api/v1/owner/customers/{$customer->id}")
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'id', 'displayName', 'phone', 'email', 'totalSpending', 'visits',
                    'bookingsCount', 'joinedAt', 'membership', 'walletBalance', 'recentBookings',
                ],
            ])
            ->assertJsonPath('data.id', (string) $customer->id)
            ->assertJsonPath('data.displayName', $customer->display_name);
    }

    /** The list count and the detail count must agree. */
    public function test_the_bookings_count_matches_the_bookings_it_returns(): void
    {
        $customer = Customer::query()
            ->forOrganization($this->org()->id)
            ->withCount('bookings')
            ->orderByDesc('bookings_count')
            ->firstOrFail();

        $body = $this->withToken($this->ownerToken())
            ->getJson("/api/v1/owner/customers/{$customer->id}")
            ->assertOk()
            ->json('data');

        $this->assertSame($customer->bookings_count, $body['bookingsCount']);
        // Capped at 20 — this is a "recent" list, not the whole history.
        $this->assertLessThanOrEqual(20, count($body['recentBookings']));
        $this->assertLessThanOrEqual($body['bookingsCount'], count($body['recentBookings']));
    }

    /** 404, not 403: a wrong answer must not confirm the id exists. */
    public function test_a_customer_of_another_venue_is_not_found(): void
    {
        $other = Organization::where('slug', '!=', 'everyday-badminton')->firstOrFail();
        $theirs = Customer::query()->forOrganization($other->id)->first()
            ?? Customer::create([
                'organization_id' => $other->id,
                'display_name' => 'ลูกค้าสนามอื่น',
                'total_spending' => 0,
                'visits' => 0,
            ]);

        $this->withToken($this->ownerToken())
            ->getJson("/api/v1/owner/customers/{$theirs->id}")
            ->assertNotFound();
    }
}
