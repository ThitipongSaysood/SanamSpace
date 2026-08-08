<?php

namespace Tests\Feature;

use App\Models\BookingRental;
use App\Models\Organization;
use App\Models\RentalItem;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Getting the equipment back, and knowing who still has it.
 *
 * Renting recorded what went out and nothing about what came in, so "who has
 * our rackets" had no answer. These lock down the half that was missing —
 * including that returning early must NOT free the item for an overlapping
 * booking, because the booking holds it for its hours either way.
 */
class EquipmentReturnTest extends TestCase
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

    private function customerToken(string $lineId = 'Ureturn'): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => $lineId,
            'displayName' => 'ลูกค้าคืนของ',
        ])->json('token');
    }

    private function ownerToken(): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');
    }

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    private function item(array $attrs = []): RentalItem
    {
        return RentalItem::create(array_merge([
            'organization_id' => $this->org()->id,
            'name' => 'ไม้แบด',
            'price' => 50,
            'price_unit' => 'per_session',
            'stock_qty' => 4,
        ], $attrs));
    }

    /** @return array{0: string, 1: array} */
    private function book(int $qty, string $date, string $start = '18:00', string $end = '19:00'): array
    {
        $racket = $this->item();
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');

        $body = $this->as($this->customerToken())->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => $date,
            'start' => $start,
            'end' => $end,
            'rentals' => [['itemId' => $racket->id, 'quantity' => $qty]],
        ])->assertCreated()->json('data');

        return [$body['id'], $body['rentals'][0]];
    }

    // ---- Taking it back --------------------------------------------------

    /** The common case: everything comes back at once. */
    public function test_the_counter_can_take_everything_back_in_one_tap(): void
    {
        [$bookingId, $line] = $this->book(2, '2026-09-05');

        $body = $this->as($this->ownerToken())
            ->postJson("/api/v1/owner/bookings/{$bookingId}/rentals/{$line['id']}/return")
            ->assertOk()
            ->json('data');

        $this->assertSame(2, $body['rentals'][0]['returnedQty']);
        $this->assertNotNull($body['rentals'][0]['returnedAt']);
    }

    /** Two out, one back — a real counter moment, so it has to be expressible. */
    public function test_a_partial_return_is_recorded_and_not_marked_complete(): void
    {
        [$bookingId, $line] = $this->book(2, '2026-09-06');
        $owner = $this->ownerToken();

        $body = $this->as($owner)
            ->postJson("/api/v1/owner/bookings/{$bookingId}/rentals/{$line['id']}/return", ['quantity' => 1])
            ->assertOk()->json('data');

        $this->assertSame(1, $body['rentals'][0]['returnedQty']);
        $this->assertNull($body['rentals'][0]['returnedAt'], 'half back is not returned');

        // The second one closes it.
        $body = $this->as($owner)
            ->postJson("/api/v1/owner/bookings/{$bookingId}/rentals/{$line['id']}/return", ['quantity' => 1])
            ->assertOk()->json('data');

        $this->assertSame(2, $body['rentals'][0]['returnedQty']);
        $this->assertNotNull($body['rentals'][0]['returnedAt']);
    }

    /** Taking back more than went out would invent stock. */
    public function test_more_cannot_come_back_than_went_out(): void
    {
        [$bookingId, $line] = $this->book(2, '2026-09-07');

        $this->as($this->ownerToken())
            ->postJson("/api/v1/owner/bookings/{$bookingId}/rentals/{$line['id']}/return", ['quantity' => 3])
            ->assertStatus(422);

        $this->assertSame(0, BookingRental::find($line['id'])->returned_qty);
    }

    /** A second "all back" on a closed line is a mistake, not a no-op. */
    public function test_a_finished_line_cannot_be_returned_again(): void
    {
        [$bookingId, $line] = $this->book(1, '2026-09-08');
        $owner = $this->ownerToken();

        $this->as($owner)->postJson("/api/v1/owner/bookings/{$bookingId}/rentals/{$line['id']}/return")->assertOk();
        $this->as($owner)->postJson("/api/v1/owner/bookings/{$bookingId}/rentals/{$line['id']}/return")
            ->assertStatus(422);
    }

    /**
     * The point of the whole feature: availability is about the time window,
     * not about what is physically on the shelf.
     *
     * Returning early must not hand the rackets to a booking that overlaps the
     * slot they were rented for — that booking was refused for a reason.
     */
    public function test_returning_early_does_not_free_the_item_for_an_overlapping_slot(): void
    {
        $racket = $this->item(['stock_qty' => 2]);
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');

        $first = $this->as($this->customerToken('Uearly'))->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => '2026-09-09',
            'start' => '18:00',
            'end' => '20:00',
            'rentals' => [['itemId' => $racket->id, 'quantity' => 2]],
        ])->assertCreated()->json('data');

        // Handed back before the slot is over.
        $this->as($this->ownerToken())
            ->postJson("/api/v1/owner/bookings/{$first['id']}/rentals/{$first['rentals'][0]['id']}/return")
            ->assertOk();

        $courts = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data');

        $this->as($this->customerToken('Uoverlap'))->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courts[1]['id'],
            'date' => '2026-09-09',
            'start' => '19:00', // overlaps
            'end' => '21:00',
            'rentals' => [['itemId' => $racket->id, 'quantity' => 1]],
        ])->assertStatus(422);
    }

    // ---- Who still has our gear ------------------------------------------

    /** Gear on a court right now is in use, not missing. */
    public function test_the_outstanding_list_ignores_bookings_that_have_not_finished(): void
    {
        $this->book(1, now()->addDays(3)->toDateString());

        $rows = $this->as($this->ownerToken())
            ->getJson('/api/v1/owner/rentals/outstanding')->assertOk()->json('data');

        $this->assertSame([], $rows);
    }

    /** Once the slot is over and nothing came back, it is a chase list. */
    public function test_the_outstanding_list_names_who_still_has_it(): void
    {
        [$bookingId, $line] = $this->book(2, now()->subDay()->toDateString());

        $rows = $this->as($this->ownerToken())
            ->getJson('/api/v1/owner/rentals/outstanding')->assertOk()->json('data');

        $this->assertCount(1, $rows);
        $this->assertSame($bookingId, $rows[0]['bookingId']);
        $this->assertSame('ลูกค้าคืนของ', $rows[0]['customerName']);
        $this->assertSame(2, $rows[0]['outstandingQty']);

        // Half back leaves half on the list.
        $this->as($this->ownerToken())
            ->postJson("/api/v1/owner/bookings/{$bookingId}/rentals/{$line['id']}/return", ['quantity' => 1])
            ->assertOk();

        $rows = $this->as($this->ownerToken())
            ->getJson('/api/v1/owner/rentals/outstanding')->assertOk()->json('data');

        $this->assertSame(1, $rows[0]['outstandingQty']);
    }

    /** A cancelled booking never took anything. */
    public function test_a_cancelled_booking_is_not_on_the_chase_list(): void
    {
        [$bookingId] = $this->book(1, now()->subDay()->toDateString());

        $this->as($this->customerToken())->postJson("/api/v1/bookings/{$bookingId}/cancel")->assertOk();

        $rows = $this->as($this->ownerToken())
            ->getJson('/api/v1/owner/rentals/outstanding')->assertOk()->json('data');

        $this->assertSame([], $rows);
    }

    // ---- Renting at the counter ------------------------------------------

    /** Staff can now put equipment on a walk-in booking, like the app can. */
    public function test_a_walk_in_booking_can_include_equipment(): void
    {
        $racket = $this->item(['name' => 'ไม้แบด', 'price' => 50]);
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');

        $body = $this->as($this->ownerToken())->postJson('/api/v1/owner/bookings', [
            'courtId' => $courtId,
            'date' => '2026-09-12',
            'start' => '18:00',
            'end' => '19:00',
            'customerName' => 'คุณเดินเข้ามา',
            'rentals' => [['itemId' => $racket->id, 'quantity' => 2]],
        ])->assertCreated()->json('data');

        $this->assertSame(100.0, (float) $body['rentalTotal']);
        $this->assertSame((float) $body['courtAmount'] + 100.0, (float) $body['amount']);
        $this->assertCount(1, $body['rentals']);
    }

    /** And the counter is held to the same availability rule as the app. */
    public function test_a_walk_in_cannot_rent_what_is_already_out(): void
    {
        $racket = $this->item(['stock_qty' => 1]);
        $courts = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data');

        $this->as($this->customerToken())->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courts[0]['id'],
            'date' => '2026-09-13',
            'start' => '18:00',
            'end' => '20:00',
            'rentals' => [['itemId' => $racket->id, 'quantity' => 1]],
        ])->assertCreated();

        $this->as($this->ownerToken())->postJson('/api/v1/owner/bookings', [
            'courtId' => $courts[1]['id'],
            'date' => '2026-09-13',
            'start' => '19:00',
            'end' => '20:00',
            'customerName' => 'คุณมาทีหลัง',
            'rentals' => [['itemId' => $racket->id, 'quantity' => 1]],
        ])->assertStatus(422);
    }

    /** A failed rental must not leave a booking behind at the counter either. */
    public function test_a_refused_walk_in_rental_creates_no_booking(): void
    {
        $racket = $this->item(['stock_qty' => 0]);
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');

        $before = \App\Models\Booking::count();

        $this->as($this->ownerToken())->postJson('/api/v1/owner/bookings', [
            'courtId' => $courtId,
            'date' => '2026-09-14',
            'start' => '18:00',
            'end' => '19:00',
            'customerName' => 'คุณไม่ได้ของ',
            'rentals' => [['itemId' => $racket->id, 'quantity' => 1]],
        ])->assertStatus(422);

        $this->assertSame($before, \App\Models\Booking::count());
    }
}
