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

    public function test_branches_returns_two_venues_in_frontend_shape(): void
    {
        $response = $this->getJson('/api/v1/branches')->assertOk();

        $response->assertJsonCount(2, 'data')
            ->assertJsonStructure([
                'data' => [['id', 'name', 'sports', 'rating', 'reviewCount', 'openTime', 'closeTime', 'address', 'imageUrl', 'facilities', 'pricePerHour', 'distanceKm']],
            ]);

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains('everyday-badminton', $ids);
        $this->assertContains('tsr-arena', $ids);
    }

    public function test_courts_filtered_by_venue_slug(): void
    {
        $this->getJson('/api/v1/courts?venueId=everyday-badminton')
            ->assertOk()
            ->assertJsonCount(6, 'data')
            ->assertJsonPath('data.0.venueId', 'everyday-badminton');

        $this->getJson('/api/v1/courts?venueId=tsr-arena')
            ->assertOk()
            ->assertJsonCount(4, 'data');
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

        $response = $this->getJson("/api/v1/courts/{$courtId}/schedules?date=2026-06-20")
            ->assertOk()
            ->assertJsonPath('data.courtId', $courtId)
            ->assertJsonPath('data.date', '2026-06-20');

        $slots = $response->json('data.slots');
        $this->assertCount(12, $slots);

        $booked = collect($slots)->where('status', 'booked')->pluck('start')->all();
        $this->assertEqualsCanonicalizing(['12:00', '19:00'], $booked); // 15:00 is cancelled → still available
    }
}
