<?php

namespace Tests\Feature;

use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VenueCourtApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    public function test_line_login_returns_token_and_user(): void
    {
        $response = $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => 'Utest123',
            'displayName' => 'Tester',
        ]);

        $response->assertOk()
            ->assertJsonStructure([
                'token',
                'user' => ['id', 'displayName', 'lineId', 'email', 'phone'],
            ]);
    }

    public function test_admin_login_and_me(): void
    {
        $login = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->assertOk();

        $token = $login->json('token');

        $this->withToken($token)->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.email', 'owner@everyday.test');
    }

    public function test_admin_login_rejects_bad_credentials(): void
    {
        $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'wrong',
        ])->assertStatus(422);
    }

    public function test_logout_revokes_token(): void
    {
        $token = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');

        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertOk();

        // The personal access token row is deleted on logout.
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    /**
     * /branches lists ONLY the current venue's branches. Each venue's customers
     * get their own app, so another venue must never appear in the list.
     */
    public function test_branches_returns_only_the_current_venue(): void
    {
        $response = $this->withHeader('X-Venue-Slug', 'everyday-badminton')
            ->getJson('/api/v1/branches')
            ->assertOk();

        $response->assertJsonStructure([
            'data' => [['id', 'name', 'sports', 'rating', 'reviewCount', 'openTime', 'closeTime', 'address', 'imageUrl', 'facilities', 'pricePerHour', 'distanceKm']],
        ]);

        // Every row belongs to this venue — asserted on the distinct ids rather
        // than a row count, because how many branches a demo venue happens to
        // have is not what this test is about.
        $ids = collect($response->json('data'))->pluck('id')->unique()->values()->all();
        $this->assertSame(['everyday-badminton'], $ids);
        $this->assertNotEmpty($response->json('data'));

        $other = $this->withHeader('X-Venue-Slug', 'tsr-arena')
            ->getJson('/api/v1/branches')
            ->assertOk();

        $this->assertSame(['tsr-arena'], collect($other->json('data'))->pluck('id')->unique()->values()->all());
    }

    /** With no venue in play there is nothing sensible to list. */
    public function test_branches_without_a_venue_is_rejected(): void
    {
        $this->getJson('/api/v1/branches')->assertNotFound();
    }

    /** Knowing a court UUID is not enough — it must be the current venue's. */
    public function test_court_from_another_venue_is_not_readable(): void
    {
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');

        $this->withHeader('X-Venue-Slug', 'everyday-badminton')
            ->getJson("/api/v1/courts/{$courtId}")
            ->assertOk();

        $this->withHeader('X-Venue-Slug', 'tsr-arena')
            ->getJson("/api/v1/courts/{$courtId}")
            ->assertNotFound();
    }

    public function test_courts_filtered_by_venue_slug(): void
    {
        // The filter, not the fixture: every court that comes back must belong
        // to the venue asked for, and none of the other venue's may appear.
        foreach (['everyday-badminton', 'tsr-arena'] as $slug) {
            $data = $this->getJson("/api/v1/courts?venueId={$slug}")->assertOk()->json('data');

            $this->assertNotEmpty($data);
            $this->assertSame([$slug], collect($data)->pluck('venueId')->unique()->values()->all());
            $this->assertCount(
                \App\Models\Court::query()->forOrganization(\App\Models\Organization::where('slug', $slug)->value('id'))->count(),
                $data,
            );
        }
    }

    public function test_court_schedule_marks_real_bookings_as_booked(): void
    {
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')
            ->json('data.0.id');

        $court = \App\Models\Court::findOrFail($courtId);
        $customer = \App\Models\Customer::where('organization_id', $court->organization_id)->firstOrFail();

        // Real bookings drive the schedule now; cancelled ones must NOT block a slot.
        foreach ([['12:00', '13:00', 'confirmed'], ['19:00', '20:00', 'confirmed'], ['15:00', '16:00', 'cancelled']] as [$start, $end, $status]) {
            \App\Models\Booking::create([
                'organization_id' => $court->organization_id,
                'branch_id' => $court->branch_id,
                'court_id' => $court->id,
                'customer_id' => $customer->id,
                'code' => "BK-TEST-{$start}",
                'date' => '2026-06-20',
                'start' => $start,
                'end' => $end,
                'amount' => 300,
                'status' => $status,
            ]);
        }

        $response = $this->withHeader('X-Venue-Slug', 'everyday-badminton')
            ->getJson("/api/v1/courts/{$courtId}/schedules?date=2026-06-20")
            ->assertOk()
            ->assertJsonPath('data.courtId', $courtId)
            ->assertJsonPath('data.date', '2026-06-20');

        $slots = $response->json('data.slots');
        $this->assertCount(12, $slots);

        $booked = collect($slots)->where('status', 'booked')->pluck('start')->all();
        $this->assertEqualsCanonicalizing(['12:00', '19:00'], $booked); // 15:00 is cancelled → still available
    }
}
