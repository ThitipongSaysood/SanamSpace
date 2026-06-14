<?php

namespace Tests\Feature;

use App\Models\Court;
use App\Models\Organization;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Owner Portal — booking scheduler mutations: create (walk-in / existing
 * customer), reschedule/edit, cancel, with overlap protection. Org-scoped.
 */
class OwnerBookingMutationsApiTest extends TestCase
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

    private function courtId(): string
    {
        $org = Organization::where('slug', 'everyday-badminton')->firstOrFail();

        return Court::where('organization_id', $org->id)->firstOrFail()->id;
    }

    public function test_owner_creates_a_walkin_booking(): void
    {
        $res = $this->withToken($this->ownerToken())->postJson('/api/v1/owner/bookings', [
            'courtId' => $this->courtId(),
            'date' => '2026-07-01',
            'start' => '14:00',
            'end' => '16:00',
            'customerName' => 'คุณวอล์คอิน',
        ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'confirmed')
            ->assertJsonPath('data.start', '14:00')
            ->assertJsonPath('data.end', '16:00');

        $this->assertGreaterThan(0, $res->json('data.amount'));
        $this->assertDatabaseHas('customers', ['display_name' => 'คุณวอล์คอิน']);
    }

    public function test_overlapping_booking_is_rejected(): void
    {
        $court = $this->courtId();
        $token = $this->ownerToken();

        $this->withToken($token)->postJson('/api/v1/owner/bookings', [
            'courtId' => $court,
            'date' => '2026-07-02',
            'start' => '10:00',
            'end' => '12:00',
            'customerName' => 'A',
        ])->assertCreated();

        $this->withToken($token)->postJson('/api/v1/owner/bookings', [
            'courtId' => $court,
            'date' => '2026-07-02',
            'start' => '11:00',
            'end' => '13:00',
            'customerName' => 'B',
        ])->assertStatus(422);
    }

    public function test_owner_can_reschedule_and_cancel(): void
    {
        $token = $this->ownerToken();

        $id = $this->withToken($token)->postJson('/api/v1/owner/bookings', [
            'courtId' => $this->courtId(),
            'date' => '2026-07-03',
            'start' => '09:00',
            'end' => '10:00',
            'customerName' => 'มูฟ',
        ])->json('data.id');

        $this->withToken($token)->putJson("/api/v1/owner/bookings/$id", [
            'start' => '18:00',
            'end' => '20:00',
        ])
            ->assertOk()
            ->assertJsonPath('data.start', '18:00')
            ->assertJsonPath('data.end', '20:00');

        $this->withToken($token)->postJson("/api/v1/owner/bookings/$id/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');
    }

    public function test_super_admin_cannot_create_booking(): void
    {
        $token = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'super@sanamspace.test',
            'password' => 'password',
        ])->json('token');

        $this->withToken($token)->postJson('/api/v1/owner/bookings', [])->assertForbidden();
    }
}
