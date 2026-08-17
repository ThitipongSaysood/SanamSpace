<?php

namespace Tests\Feature;

use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** The owner side: creating, scoping, editing and retiring a flash sale. */
class FlashSaleCrudTest extends TestCase
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
        return $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');
    }

    public function test_create_scope_list_update_and_soft_delete(): void
    {
        $token = $this->ownerToken();
        $court = $this->courtId();

        // Create — scoped to one court, 20% off weekday afternoons.
        $created = $this->withToken($token)->postJson('/api/v1/owner/flash-sales', [
            'name' => 'ลดช่วงบ่าย',
            'discountType' => 'percent',
            'discountValue' => 20,
            'validFromTime' => '13:00',
            'validToTime' => '16:00',
            'validDays' => [1, 2, 3, 4, 5],
            'courtIds' => [$court],
        ])->assertCreated()->json('data');

        $this->assertEquals('ลดช่วงบ่าย', $created['name']);
        $this->assertEquals([$court], $created['courtIds']);
        $this->assertStringContainsString('13:00', $created['conditionLabel']);

        $id = $created['id'];

        // List
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/owner/flash-sales')
            ->assertOk()->assertJsonPath('data.0.id', $id);

        // Update — widen the discount, clear the court scope (whole venue).
        $this->app['auth']->forgetGuards();
        $updated = $this->withToken($token)->putJson("/api/v1/owner/flash-sales/{$id}", [
            'discountValue' => 30,
            'courtIds' => [],
        ])->assertOk()->json('data');

        $this->assertEquals(30.0, $updated['discountValue']);
        $this->assertEquals([], $updated['courtIds']);

        // Soft delete
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->deleteJson("/api/v1/owner/flash-sales/{$id}")->assertNoContent();

        $this->assertSoftDeleted('flash_sales', ['id' => $id]);
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/owner/flash-sales')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_the_window_hours_are_required(): void
    {
        $this->withToken($this->ownerToken())->postJson('/api/v1/owner/flash-sales', [
            'name' => 'ไม่มีช่วงเวลา',
            'discountValue' => 20,
        ])->assertStatus(422)->assertJsonValidationErrors(['validFromTime', 'validToTime']);
    }

    public function test_a_court_from_another_venue_is_rejected(): void
    {
        $otherCourt = $this->getJson('/api/v1/courts?venueId=tsr-arena')->json('data.0.id');

        $this->withToken($this->ownerToken())->postJson('/api/v1/owner/flash-sales', [
            'name' => 'ข้ามสนาม',
            'discountValue' => 20,
            'validFromTime' => '13:00',
            'validToTime' => '16:00',
            'courtIds' => [$otherCourt],
        ])->assertStatus(422)->assertJsonValidationErrors('courtIds.0');
    }
}
