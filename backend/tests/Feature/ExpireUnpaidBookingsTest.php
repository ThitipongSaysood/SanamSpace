<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Court;
use App\Models\Customer;
use App\Models\Notification;
use App\Models\Organization;
use App\Models\Payment;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * #2 — an unpaid booking must not hold its court slot forever. The scheduled
 * `bookings:expire-unpaid` command cancels pending_payment bookings past the
 * hold window (config('booking.hold_minutes')) and frees the slot.
 */
class ExpireUnpaidBookingsTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;

    private Customer $customer;

    private Court $court;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
        config(['booking.hold_minutes' => 30]);

        $this->org = Organization::where('slug', 'everyday-badminton')->firstOrFail();
        $this->customer = Customer::create([
            'organization_id' => $this->org->id,
            'display_name' => 'Expiry Tester',
        ]);
        $this->court = Court::where('organization_id', $this->org->id)->firstOrFail();
    }

    private function makeBooking(string $code, int $ageMinutes): Booking
    {
        $booking = Booking::create([
            'organization_id' => $this->org->id,
            'branch_id' => $this->court->branch_id,
            'court_id' => $this->court->id,
            'customer_id' => $this->customer->id,
            'code' => $code,
            'date' => '2026-09-01',
            'start' => '18:00',
            'end' => '19:00',
            'amount' => 250,
            'status' => 'pending_payment',
        ]);

        // Backdate creation without touching any other column.
        Booking::where('id', $booking->id)->update(['created_at' => now()->subMinutes($ageMinutes)]);

        return $booking->fresh();
    }

    public function test_a_stale_unpaid_booking_is_cancelled_and_notified(): void
    {
        $booking = $this->makeBooking('BKSTALE1', 40);

        $this->artisan('bookings:expire-unpaid')->assertSuccessful();

        $this->assertSame('cancelled', $booking->fresh()->status);
        $this->assertDatabaseHas('notifications', [
            'customer_id' => $this->customer->id,
            'title' => 'การจองหมดเวลาชำระเงิน',
        ]);
    }

    public function test_a_fresh_unpaid_booking_is_left_alone(): void
    {
        $booking = $this->makeBooking('BKFRESH1', 5);

        $this->artisan('bookings:expire-unpaid')->assertSuccessful();

        $this->assertSame('pending_payment', $booking->fresh()->status);
    }

    public function test_a_booking_awaiting_slip_review_is_protected(): void
    {
        // Customer already paid (slip uploaded, pending_review) — the booking is
        // still pending_payment until the venue approves, but must NOT expire.
        $booking = $this->makeBooking('BKPAID01', 40);
        Payment::create([
            'organization_id' => $this->org->id,
            'booking_id' => $booking->id,
            'customer_id' => $this->customer->id,
            'method' => 'transfer',
            'amount' => 250,
            'status' => 'pending_review',
        ]);

        $this->artisan('bookings:expire-unpaid')->assertSuccessful();

        $this->assertSame('pending_payment', $booking->fresh()->status);
    }

    public function test_cancelling_a_stale_booking_frees_the_slot_for_a_new_one(): void
    {
        $this->makeBooking('BKHOLD01', 40);

        $this->artisan('bookings:expire-unpaid')->assertSuccessful();

        // Same court/date/time is bookable again by a customer via the API.
        $token = $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => 'Uexpiry',
            'displayName' => 'Fresh Booker',
        ])->json('token');

        $this->withToken($token)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $this->court->id,
            'date' => '2026-09-01',
            'start' => '18:00',
            'end' => '19:00',
        ])->assertCreated();
    }
}
