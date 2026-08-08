<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Organization;
use App\Models\RentalItem;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Renting equipment as part of a booking.
 *
 * The whole risk here is availability. Stock says how many rackets the venue
 * owns; four rackets can be rented all day, just not to two overlapping
 * bookings at once. Most of these tests are about that distinction.
 */
class EquipmentRentalTest extends TestCase
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

    private function customerToken(string $lineId = 'Urental'): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => $lineId,
            'displayName' => 'ลูกค้าเช่าของ',
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

    private function courtId(): string
    {
        return $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');
    }

    /** @return array{0: string, 1: array} booking id and its body */
    private function book(string $token, array $rentals, string $date, string $start, string $end): array
    {
        $body = $this->as($token)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $this->courtId(),
            'date' => $date,
            'start' => $start,
            'end' => $end,
            'rentals' => $rentals,
        ])->assertCreated()->json('data');

        return [$body['id'], $body];
    }

    // --- the money the customer is asked to transfer -------------------------

    /** The breakdown is the point: court + each item, and one grand total. */
    public function test_a_booking_with_rentals_shows_the_parts_and_the_total(): void
    {
        $racket = $this->item(['name' => 'ไม้แบด', 'price' => 50, 'price_unit' => 'per_session']);
        $shoes = $this->item(['name' => 'รองเท้า', 'price' => 40, 'price_unit' => 'per_hour']);

        [, $body] = $this->book(
            $this->customerToken(),
            [
                ['itemId' => $racket->id, 'quantity' => 2],
                ['itemId' => $shoes->id, 'quantity' => 1],
            ],
            '2026-09-20',
            '18:00',
            '20:00', // 2 hours
        );

        $court = (float) $body['courtAmount'];

        // per_session: 50 x 2 = 100. per_hour: 40 x 2h x 1 = 80.
        $this->assertSame(180.0, (float) $body['rentalTotal']);
        $this->assertSame($court + 180.0, (float) $body['amount']);
        $this->assertCount(2, $body['rentals']);

        $lines = collect($body['rentals'])->keyBy('name');
        $this->assertSame(100.0, (float) $lines['ไม้แบด']['lineTotal']);
        $this->assertSame(80.0, (float) $lines['รองเท้า']['lineTotal']);
    }

    /** A booking with no rentals must be exactly what it was before. */
    public function test_a_booking_without_rentals_is_unchanged(): void
    {
        [, $body] = $this->book($this->customerToken(), [], '2026-09-21', '10:00', '11:00');

        $this->assertSame(0.0, (float) $body['rentalTotal']);
        $this->assertSame((float) $body['courtAmount'], (float) $body['amount']);
        $this->assertSame([], $body['rentals']);
    }

    /** What the customer pays is what the payment asks for. */
    public function test_the_payment_asks_for_the_grand_total(): void
    {
        $racket = $this->item(['price' => 50]);
        $token = $this->customerToken();

        [$bookingId, $body] = $this->book(
            $token,
            [['itemId' => $racket->id, 'quantity' => 2]],
            '2026-09-22',
            '18:00',
            '19:00',
        );

        $payment = $this->as($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId,
            'method' => 'promptpay',
        ])->assertCreated()->json('data');

        $this->assertSame((float) $body['amount'], (float) $payment['amount']);
        $this->assertGreaterThan((float) $body['courtAmount'], (float) $payment['amount']);
    }

    // --- availability is a question about a time window ----------------------

    /** Four rackets, all four out at 18:00 — none left for an overlapping slot. */
    public function test_an_overlapping_booking_cannot_take_more_than_the_venue_owns(): void
    {
        $racket = $this->item(['name' => 'ไม้แบด', 'stock_qty' => 4]);

        $this->book($this->customerToken('Ufirst'), [['itemId' => $racket->id, 'quantity' => 4]], '2026-09-23', '18:00', '20:00');

        $response = $this->as($this->customerToken('Usecond'))->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.1.id'),
            'date' => '2026-09-23',
            'start' => '19:00', // overlaps
            'end' => '21:00',
            'rentals' => [['itemId' => $racket->id, 'quantity' => 1]],
        ])->assertStatus(422);

        $this->assertStringContainsString('ไม้แบด', implode(' ', $response->json('errors.rentals')));
    }

    /** …but the same rackets are free again once the first booking ends. */
    public function test_the_same_item_can_be_rented_again_in_a_later_slot(): void
    {
        $racket = $this->item(['stock_qty' => 4]);

        $this->book($this->customerToken('Uearly'), [['itemId' => $racket->id, 'quantity' => 4]], '2026-09-24', '10:00', '11:00');

        // 11:00 starts exactly when the other ends — not an overlap.
        [, $body] = $this->book($this->customerToken('Ulate'), [['itemId' => $racket->id, 'quantity' => 4]], '2026-09-24', '11:00', '12:00');

        $this->assertSame(4, (int) $body['rentals'][0]['quantity']);
    }

    /** A cancelled booking is not holding anything. */
    public function test_cancelling_frees_the_equipment_up_again(): void
    {
        $racket = $this->item(['stock_qty' => 2]);
        $token = $this->customerToken('Ucancel');

        [$bookingId] = $this->book($token, [['itemId' => $racket->id, 'quantity' => 2]], '2026-09-25', '18:00', '19:00');

        $this->as($token)->postJson("/api/v1/bookings/{$bookingId}/cancel")->assertOk();

        [, $body] = $this->book($this->customerToken('Uafter'), [['itemId' => $racket->id, 'quantity' => 2]], '2026-09-25', '18:00', '19:00');
        $this->assertSame(2, (int) $body['rentals'][0]['quantity']);
    }

    /** Two picks of the same racket is one line of two, checked as two. */
    public function test_duplicate_lines_are_merged_before_the_availability_check(): void
    {
        $racket = $this->item(['stock_qty' => 3]);

        $this->as($this->customerToken())->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $this->courtId(),
            'date' => '2026-09-26',
            'start' => '18:00',
            'end' => '19:00',
            'rentals' => [
                ['itemId' => $racket->id, 'quantity' => 2],
                ['itemId' => $racket->id, 'quantity' => 2],
            ],
        ])->assertStatus(422);

        $this->assertSame(0, Booking::whereDate('date', '2026-09-26')->count());
    }

    /** A basket the venue cannot equip must not take a court slot either. */
    public function test_a_failed_rental_leaves_no_booking_behind(): void
    {
        $racket = $this->item(['stock_qty' => 1]);

        $this->as($this->customerToken())->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $this->courtId(),
            'date' => '2026-09-27',
            'start' => '18:00',
            'end' => '19:00',
            'rentals' => [['itemId' => $racket->id, 'quantity' => 5]],
        ])->assertStatus(422);

        $this->assertSame(0, Booking::whereDate('date', '2026-09-27')->count());
    }

    public function test_another_venues_equipment_cannot_be_rented(): void
    {
        $other = Organization::where('slug', '!=', 'everyday-badminton')->firstOrFail();
        $theirs = RentalItem::create([
            'organization_id' => $other->id,
            'name' => 'ของสนามอื่น',
            'price' => 50,
            'stock_qty' => 10,
        ]);

        $this->as($this->customerToken())->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $this->courtId(),
            'date' => '2026-09-28',
            'start' => '18:00',
            'end' => '19:00',
            'rentals' => [['itemId' => $theirs->id, 'quantity' => 1]],
        ])->assertStatus(422);
    }

    // --- what the booking screen offers --------------------------------------

    /** Availability without a time is not an answer, so the window is required. */
    public function test_the_offer_reports_what_is_free_for_that_window(): void
    {
        $racket = $this->item(['name' => 'ไม้แบด', 'price' => 50, 'stock_qty' => 4]);
        $this->book($this->customerToken('Uhold'), [['itemId' => $racket->id, 'quantity' => 3]], '2026-09-29', '18:00', '20:00');

        $this->app['auth']->forgetGuards();
        $overlapping = $this->getJson('/api/v1/rentals?date=2026-09-29&start=19:00&end=21:00', ['X-Venue-Slug' => 'everyday-badminton'])
            ->assertOk()
            ->json('data.0');

        $this->assertSame(1, $overlapping['availableQty']);

        $clear = $this->getJson('/api/v1/rentals?date=2026-09-29&start=08:00&end=09:00', ['X-Venue-Slug' => 'everyday-badminton'])
            ->assertOk()
            ->json('data.0');

        $this->assertSame(4, $clear['availableQty']);
    }

    /** A per-hour item must be quoted for the hours actually being booked. */
    public function test_the_offer_prices_a_per_hour_item_for_the_slot(): void
    {
        $this->item(['name' => 'เครื่องยิงลูก', 'price' => 100, 'price_unit' => 'per_hour', 'stock_qty' => 1]);

        $this->app['auth']->forgetGuards();
        $row = $this->getJson('/api/v1/rentals?date=2026-09-30&start=18:00&end=21:00', ['X-Venue-Slug' => 'everyday-badminton'])
            ->assertOk()
            ->json('data.0');

        $this->assertSame(300.0, (float) $row['priceForBooking']); // 100 x 3h
    }

    public function test_the_offer_needs_a_time_window(): void
    {
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/rentals?date=2026-09-30', ['X-Venue-Slug' => 'everyday-badminton'])
            ->assertStatus(422);
    }

    // --- the back office ------------------------------------------------------

    public function test_an_owner_can_manage_equipment_and_see_what_is_out(): void
    {
        $token = $this->ownerToken();

        $id = $this->as($token)->postJson('/api/v1/owner/rental-items', [
            'name' => 'ไม้แบด Yonex',
            'price' => 60,
            'priceUnit' => 'per_session',
            'stockQty' => 6,
        ])->assertCreated()->json('data.id');

        $this->as($token)->putJson("/api/v1/owner/rental-items/{$id}", ['price' => 70])
            ->assertOk()
            ->assertJsonPath('data.price', 70);

        $this->book($this->customerToken('Uout'), [['itemId' => $id, 'quantity' => 2]], now()->toDateString(), '18:00', '19:00');

        $this->as($token)->getJson('/api/v1/owner/rental-items/out')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'ไม้แบด Yonex')
            ->assertJsonPath('data.0.quantity', 2);
    }

    /** Changing a price must not rewrite what an earlier customer was quoted. */
    public function test_a_past_rental_keeps_the_price_it_was_quoted_at(): void
    {
        $racket = $this->item(['name' => 'ไม้แบด', 'price' => 50]);

        [$bookingId] = $this->book($this->customerToken(), [['itemId' => $racket->id, 'quantity' => 1]], '2026-10-01', '18:00', '19:00');

        $racket->update(['name' => 'ไม้แบดรุ่นใหม่', 'price' => 200]);

        $body = $this->as($this->customerToken())->getJson("/api/v1/bookings/{$bookingId}")
            ->assertOk()
            ->json('data');

        $this->assertSame('ไม้แบด', $body['rentals'][0]['name']);
        $this->assertSame(50.0, (float) $body['rentals'][0]['unitPrice']);
    }

    /**
     * Moving a booking must not quietly wipe the rented gear off the bill.
     *
     * The owner edit repriced the court and wrote that straight to `amount`,
     * which is the grand total — so a ฿250 court with ฿180 of rentals became a
     * ฿250 booking, and the customer had already been told ฿430.
     */
    public function test_editing_a_booking_keeps_its_rental_charge(): void
    {
        $racket = $this->item(['name' => 'ไม้แบด', 'price' => 50, 'price_unit' => 'per_session']);

        [$bookingId, $before] = $this->book(
            $this->customerToken(),
            [['itemId' => $racket->id, 'quantity' => 2]],
            '2026-10-05',
            '18:00',
            '19:00',
        );

        $this->assertSame(100.0, (float) $before['rentalTotal']);

        // Same length, one hour later — the court price does not change.
        $after = $this->as($this->ownerToken())->putJson("/api/v1/owner/bookings/{$bookingId}", [
            'start' => '19:00',
            'end' => '20:00',
        ])->assertOk()->json('data');

        $this->assertSame((float) $before['courtAmount'], (float) $after['courtAmount']);
        $this->assertSame(100.0, (float) $after['rentalTotal']);
        $this->assertSame((float) $before['amount'], (float) $after['amount']);
    }

    /**
     * A package buys court time, not equipment.
     *
     * Redeeming one used to zero `amount` — the grand total — so a customer
     * with a package walked out with ฿180 of rented gear for nothing, and the
     * booking confirmed itself on the way.
     */
    public function test_a_package_does_not_pay_for_the_equipment(): void
    {
        $racket = $this->item(['name' => 'ไม้แบด', 'price' => 90, 'price_unit' => 'per_session']);
        $token = $this->customerToken();

        [$bookingId] = $this->book($token, [['itemId' => $racket->id, 'quantity' => 2]], '2026-10-08', '18:00', '19:00');

        $customerId = \App\Models\Customer::where('line_user_id', 'Urental')->value('id');
        $package = \App\Models\CustomerPackage::create([
            'organization_id' => $this->org()->id,
            'customer_id' => $customerId,
            'name' => 'แพ็ก 10 ชม.',
            'total_hours' => 10,
            'remaining_hours' => 10,
            'status' => 'active',
        ]);

        $body = $this->as($token)->postJson("/api/v1/bookings/{$bookingId}/pay-with-package", [
            'customerPackageId' => $package->id,
        ])->assertOk()->json('data');

        // The court hour is gone from the package; the rackets are still owed.
        $this->assertSame(9.0, (float) $package->fresh()->remaining_hours);
        $this->assertSame(180.0, (float) $body['amount']);
        $this->assertSame('pending_payment', $body['status']);

        // …and the still-pending booking must not swallow a second package.
        $this->as($token)->postJson("/api/v1/bookings/{$bookingId}/pay-with-package", [
            'customerPackageId' => $package->id,
        ])->assertStatus(422);

        $this->assertSame(9.0, (float) $package->fresh()->remaining_hours);
    }

    /** With no equipment on it, a package still settles the booking outright. */
    public function test_a_package_still_confirms_a_court_only_booking(): void
    {
        $token = $this->customerToken();
        [$bookingId] = $this->book($token, [], '2026-10-09', '18:00', '19:00');

        $customerId = \App\Models\Customer::where('line_user_id', 'Urental')->value('id');
        $package = \App\Models\CustomerPackage::create([
            'organization_id' => $this->org()->id,
            'customer_id' => $customerId,
            'name' => 'แพ็ก 10 ชม.',
            'total_hours' => 10,
            'remaining_hours' => 10,
            'status' => 'active',
        ]);

        $body = $this->as($token)->postJson("/api/v1/bookings/{$bookingId}/pay-with-package", [
            'customerPackageId' => $package->id,
        ])->assertOk()->json('data');

        $this->assertSame(0.0, (float) $body['amount']);
        $this->assertSame('confirmed', $body['status']);
    }

    /** Counter staff may look; changing what the venue owns is not counter work. */
    public function test_managing_equipment_is_gated(): void
    {
        $user = \App\Models\User::create([
            'name' => 'Cashier', 'display_name' => 'Cashier',
            'email' => 'rental-cashier@everyday.test', 'password' => 'password',
        ]);
        \App\Models\OrganizationUser::create([
            'organization_id' => $this->org()->id,
            'user_id' => $user->id,
            'role_id' => \App\Models\Role::where('code', 'cashier')->value('id'),
            'display_name' => $user->display_name,
            'status' => 'active',
            'joined_at' => now(),
        ]);

        $this->app['auth']->forgetGuards();
        $token = $this->postJson('/api/v1/auth/admin/login', [
            'email' => $user->email, 'password' => 'password',
        ])->json('token');

        $this->as($token)->getJson('/api/v1/owner/rental-items')->assertOk();
        $this->as($token)->postJson('/api/v1/owner/rental-items', ['name' => 'x', 'price' => 1])
            ->assertForbidden();
    }
}
