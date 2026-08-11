<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BookingRental;
use App\Models\Court;
use App\Models\Customer;
use App\Models\Organization;
use App\Support\VenueClock;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Today, at this venue.
 *
 * The screen this feeds is read at the counter to answer "is anything wrong
 * right now". So the assertions are mostly about what must NOT appear: a
 * customer five minutes late is not a no-show, equipment still on a court that
 * is still playing is not missing, and a cancelled booking owes nothing.
 * A list that flags all of those is a list nobody reads.
 */
class OperationsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);

        // The seeder fills today with demo bookings; this screen is entirely
        // about today, so they would drown every assertion below.
        Booking::query()->forOrganization($this->org()->id)->forceDelete();
        // Every test here places a booking at an offset from "now".
        $this->freezeVenueClockAtMidday($this->org()->id);
    }

    // ---- the timeline is actually today ------------------------------------

    /**
     * The bug this replaced: the old "Timeline วันนี้" showed the six most
     * recently CREATED bookings, so one made today for next month appeared in
     * today, and today's seventh booking did not appear at all.
     */
    public function test_the_timeline_is_todays_bookings_not_the_newest_ones(): void
    {
        $today = $this->bookingAt(-60, 0, 'คุณวันนี้');
        $this->bookingAt(60, 120, 'คุณพรุ่งนี้')->update(['date' => VenueClock::now($this->org()->id)->addMonth()->toDateString()]);

        $codes = collect($this->ops()['timeline'])->pluck('code')->all();

        $this->assertContains($today->code, $codes);
        $this->assertCount(1, $codes, 'next month is not today');
    }

    public function test_the_timeline_is_in_time_order_and_marks_where_now_is(): void
    {
        $this->bookingAt(60, 120, 'คุณกำลังจะมา');
        $this->bookingAt(-30, 30, 'คุณกำลังเล่น');
        $this->bookingAt(-180, -120, 'คุณเล่นจบแล้ว');

        $rows = $this->ops()['timeline'];

        $this->assertSame(['done', 'now', 'upcoming'], array_column($rows, 'phase'));
        $this->assertSame(
            array_column($rows, 'start'),
            collect($rows)->pluck('start')->sort()->values()->all(),
        );
    }

    // ---- what needs doing --------------------------------------------------

    public function test_a_customer_who_never_arrived_is_flagged(): void
    {
        $this->bookingAt(-40, 20, 'คุณไม่มา');

        $noShow = $this->ops()['attention']['noShow'];

        $this->assertCount(1, $noShow);
        $this->assertSame('คุณไม่มา', $noShow[0]['customerName']);
        $this->assertSame(40, $noShow[0]['lateMinutes']);
    }

    /** Five minutes late is late, not a no-show. */
    public function test_someone_only_slightly_late_is_left_alone(): void
    {
        $this->bookingAt(-5, 55, 'คุณสายนิดเดียว');

        $this->assertCount(0, $this->ops()['attention']['noShow']);
    }

    public function test_someone_who_checked_in_is_not_a_no_show(): void
    {
        $this->bookingAt(-40, 20, 'คุณมาแล้ว')->update(['checked_in_at' => now()]);

        $this->assertCount(0, $this->ops()['attention']['noShow']);
    }

    /** Their slot is over — chasing them now helps nobody. */
    public function test_a_finished_booking_is_not_a_no_show(): void
    {
        $this->bookingAt(-180, -120, 'คุณเมื่อเช้า');

        $this->assertCount(0, $this->ops()['attention']['noShow']);
    }

    public function test_money_still_owed_today_is_listed_and_totalled(): void
    {
        $this->bookingAt(-30, 30, 'คุณค้างจ่าย')->update(['amount' => 500, 'paid_amount' => 200]);
        $this->bookingAt(60, 120, 'คุณจ่ายครบ')->update(['amount' => 300, 'paid_amount' => 300]);

        $ops = $this->ops();

        $this->assertCount(1, $ops['attention']['unpaid']);
        $this->assertSame(300.0, (float) $ops['attention']['unpaid'][0]['outstanding']);
        $this->assertSame(300.0, (float) $ops['tiles']['outstanding']);
    }

    /** A cancelled booking owes nothing, however little was paid on it. */
    public function test_a_cancelled_booking_is_not_money_to_collect(): void
    {
        $this->bookingAt(-30, 30, 'คุณยกเลิก')->update(['amount' => 500, 'paid_amount' => 0, 'status' => 'cancelled']);

        $ops = $this->ops();

        $this->assertCount(0, $ops['attention']['unpaid']);
        $this->assertSame(0.0, (float) $ops['tiles']['outstanding']);
    }

    public function test_equipment_not_returned_after_the_slot_is_flagged(): void
    {
        $booking = $this->bookingAt(-180, -120, 'คุณยืมไม้');
        $this->rental($booking, 'ไม้แบด', quantity: 2, returned: 0);

        $out = $this->ops()['attention']['equipmentOut'];

        $this->assertCount(1, $out);
        $this->assertSame('ไม้แบด', $out[0]['items'][0]['name']);
        $this->assertSame(2, $out[0]['items'][0]['qty']);
    }

    /** Still playing, so the racket is supposed to be out there. */
    public function test_equipment_on_a_court_still_in_play_is_not_flagged(): void
    {
        $booking = $this->bookingAt(-30, 30, 'คุณกำลังเล่น');
        $this->rental($booking, 'ไม้แบด', quantity: 2, returned: 0);

        $this->assertCount(0, $this->ops()['attention']['equipmentOut']);
    }

    public function test_equipment_all_returned_is_not_flagged(): void
    {
        $booking = $this->bookingAt(-180, -120, 'คุณคืนแล้ว');
        $this->rental($booking, 'ไม้แบด', quantity: 2, returned: 2);

        $this->assertCount(0, $this->ops()['attention']['equipmentOut']);
    }

    /** Two of three back is still one missing. */
    public function test_a_partial_return_still_counts_what_is_missing(): void
    {
        $booking = $this->bookingAt(-180, -120, 'คุณคืนไม่ครบ');
        $this->rental($booking, 'ไม้แบด', quantity: 3, returned: 2);

        $out = $this->ops()['attention']['equipmentOut'];

        $this->assertCount(1, $out);
        $this->assertSame(1, $out[0]['items'][0]['qty']);
    }

    // ---- scope and clock ---------------------------------------------------

    public function test_it_reads_the_venue_clock_not_the_servers(): void
    {
        $venueNow = VenueClock::now($this->org()->id);

        $this->assertNotSame($venueNow->format('H:i'), Carbon::now('UTC')->format('H:i'));
        $this->assertSame($venueNow->format('H:i'), $this->ops()['now']);
        $this->assertSame($venueNow->toDateString(), $this->ops()['today']);
    }

    public function test_it_shows_only_this_venues_day(): void
    {
        $other = Organization::where('slug', '!=', 'everyday-badminton')->firstOrFail();
        $court = Court::query()->forOrganization($other->id)->firstOrFail();
        $now = VenueClock::now($other->id);
        $customer = Customer::create(['organization_id' => $other->id, 'display_name' => 'คุณสนามอื่น']);

        Booking::create([
            'organization_id' => $other->id, 'branch_id' => $court->branch_id, 'court_id' => $court->id,
            'customer_id' => $customer->id, 'code' => 'BKOTHER1',
            'date' => $now->toDateString(), 'start' => $now->format('H:i'), 'end' => $now->copy()->addHour()->format('H:i'),
            'amount' => 300, 'status' => 'confirmed', 'channel' => 'walkin',
        ]);

        $this->assertCount(0, $this->ops()['timeline']);
    }

    // ---- fixtures ----------------------------------------------------------

    private function ops(): array
    {
        return $this->as($this->login('owner@everyday.test'))
            ->getJson('/api/v1/owner/operations')
            ->assertOk()
            ->json('data');
    }

    private function bookingAt(int $fromMinutes, int $toMinutes, string $customerName): Booking
    {
        $now = VenueClock::now($this->org()->id);
        $court = Court::query()->forOrganization($this->org()->id)->orderBy('sort_order')->firstOrFail();
        $customer = Customer::create(['organization_id' => $this->org()->id, 'display_name' => $customerName]);

        return Booking::create([
            'organization_id' => $this->org()->id,
            'branch_id' => $court->branch_id,
            'court_id' => $court->id,
            'customer_id' => $customer->id,
            'code' => 'BKOPS'.random_int(10000, 99999),
            'date' => $now->toDateString(),
            'start' => $now->copy()->addMinutes($fromMinutes)->format('H:i'),
            'end' => $now->copy()->addMinutes($toMinutes)->format('H:i'),
            'amount' => 300,
            'paid_amount' => 300,
            'status' => 'confirmed',
            'channel' => 'walkin',
        ]);
    }

    private function rental(Booking $booking, string $name, int $quantity, int $returned): BookingRental
    {
        return BookingRental::create([
            'booking_id' => $booking->id,
            'name' => $name,
            'unit_price' => 50,
            'price_unit' => 'per_booking',
            'quantity' => $quantity,
            'hours' => 1,
            'line_total' => 50 * $quantity,
            'returned_qty' => $returned,
            'returned_at' => $returned > 0 ? now() : null,
        ]);
    }

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    private function as(string $token): self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    private function login(string $email): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/admin/login', ['email' => $email, 'password' => 'password'])->json('token');
    }
}
