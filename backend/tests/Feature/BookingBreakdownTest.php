<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\Customer;
use App\Models\CustomerPackage;
use App\Models\Organization;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A booking has to be able to explain its own price.
 *
 * Court, equipment, a code, credit spent, what has been paid and what is left —
 * every one of these is a question someone asks at the counter, and a bare
 * total cannot be checked against anything. A booking paid with credit was the
 * worst case: it simply looked free.
 */
class BookingBreakdownTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function token(string $lineId = 'Ubreakdown'): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => $lineId,
            'displayName' => 'คุณรายละเอียด',
        ])->json('token');
    }

    private function ownerToken(): string
    {
        $this->app['auth']->forgetGuards();

        $t = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');

        $this->app['auth']->forgetGuards();

        return $t;
    }

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    private function book(string $token, array $extra = [], string $date = '2026-12-05'): array
    {
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');
        $this->app['auth']->forgetGuards();

        return $this->withToken($token)->postJson('/api/v1/bookings', array_merge([
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => $date,
            'start' => '18:00',
            'end' => '20:00', // 2 hours, so credit hours are not 1 by accident
        ], $extra))->assertCreated()->json('data');
    }

    private function package(float $hours = 10): CustomerPackage
    {
        $customer = Customer::where('line_user_id', 'Ubreakdown')->firstOrFail();

        return CustomerPackage::create([
            'organization_id' => $customer->organization_id,
            'customer_id' => $customer->id,
            'name' => 'แพ็ก 10 ชั่วโมง',
            'total_hours' => $hours,
            'remaining_hours' => $hours,
            'status' => 'active',
        ]);
    }

    // ---- credit ----------------------------------------------------------

    /** Paying with credit must say so, in hours, on the booking itself. */
    public function test_a_booking_paid_with_credit_says_how_much_credit_it_used(): void
    {
        $token = $this->token();
        $booking = $this->book($token);
        $package = $this->package();

        $this->app['auth']->forgetGuards();
        $after = $this->withToken($token)
            ->postJson("/api/v1/bookings/{$booking['id']}/pay-with-package", ['customerPackageId' => $package->id])
            ->assertOk()->json('data');

        $this->assertNotNull($after['credit'], 'a credit-paid booking must say so');
        $this->assertSame('แพ็ก 10 ชั่วโมง', $after['credit']['packageName']);
        $this->assertSame(2.0, (float) $after['credit']['hoursUsed']);
        $this->assertSame(8.0, (float) $after['credit']['remainingHours']);
        $this->assertNotNull($after['credit']['redeemedAt']);
        $this->assertSame(0.0, (float) $after['amount'], 'nothing left to transfer');
    }

    /** A booking nobody spent credit on must not claim it did. */
    public function test_a_normal_booking_has_no_credit_block(): void
    {
        $booking = $this->book($this->token());

        $this->assertArrayNotHasKey('credit', $booking);
    }

    /** Rescheduling later must not rewrite how much credit was actually spent. */
    public function test_the_credit_hours_are_a_snapshot(): void
    {
        $token = $this->token();
        $booking = $this->book($token);
        $package = $this->package();

        $this->app['auth']->forgetGuards();
        $this->withToken($token)
            ->postJson("/api/v1/bookings/{$booking['id']}/pay-with-package", ['customerPackageId' => $package->id])
            ->assertOk();

        // The venue moves them to a one-hour slot.
        $this->withToken($this->ownerToken())->putJson("/api/v1/owner/bookings/{$booking['id']}", [
            'start' => '18:00',
            'end' => '19:00',
        ])->assertOk();

        $this->app['auth']->forgetGuards();
        $after = $this->withToken($token)->getJson("/api/v1/bookings/{$booking['id']}")->assertOk()->json('data');

        $this->assertSame(2.0, (float) $after['credit']['hoursUsed'], 'still the two hours actually deducted');
    }

    /** The venue sees the same thing the customer does. */
    public function test_the_owner_sees_the_credit_too(): void
    {
        $token = $this->token();
        $booking = $this->book($token);
        $package = $this->package();

        $this->app['auth']->forgetGuards();
        $this->withToken($token)
            ->postJson("/api/v1/bookings/{$booking['id']}/pay-with-package", ['customerPackageId' => $package->id])
            ->assertOk();

        $row = $this->withToken($this->ownerToken())
            ->getJson("/api/v1/owner/bookings/{$booking['id']}")->assertOk()->json('data');

        $this->assertSame(2.0, (float) $row['credit']['hoursUsed']);
        $this->assertSame('แพ็ก 10 ชั่วโมง', $row['credit']['packageName']);
    }

    /** Credit covers the court; equipment is still owed, and both are visible. */
    public function test_credit_and_an_unpaid_equipment_balance_are_both_shown(): void
    {
        $racket = \App\Models\RentalItem::create([
            'organization_id' => $this->org()->id,
            'name' => 'ไม้แบด',
            'price' => 60,
            'price_unit' => 'per_session',
            'stock_qty' => 4,
        ]);

        $token = $this->token();
        $booking = $this->book($token, ['rentals' => [['itemId' => $racket->id, 'quantity' => 1]]]);
        $package = $this->package();

        $this->app['auth']->forgetGuards();
        $after = $this->withToken($token)
            ->postJson("/api/v1/bookings/{$booking['id']}/pay-with-package", ['customerPackageId' => $package->id])
            ->assertOk()->json('data');

        $this->assertSame(2.0, (float) $after['credit']['hoursUsed']);
        $this->assertSame(60.0, (float) $after['amount'], 'the racket is still owed');
        $this->assertSame(60.0, (float) $after['outstandingAmount']);
    }

    // ---- discount --------------------------------------------------------

    /** A code that took money off has to be named on the booking. */
    public function test_a_discounted_booking_names_the_code(): void
    {
        Coupon::create([
            'organization_id' => $this->org()->id,
            'code' => 'SHOWME',
            'type' => 'percent',
            'value' => 20,
        ]);

        $booking = $this->book($this->token(), ['couponCode' => 'SHOWME']);

        $this->assertSame(100.0, (float) $booking['discountAmount']); // 20% of 500
        $this->assertSame('คูปอง SHOWME', $booking['discountLabel']);
        $this->assertSame(400.0, (float) $booking['amount']);
    }

    /** And the venue sees the same explanation. */
    public function test_the_owner_sees_the_discount_too(): void
    {
        Coupon::create([
            'organization_id' => $this->org()->id,
            'code' => 'SHOWME',
            'type' => 'fixed',
            'value' => 50,
        ]);

        $booking = $this->book($this->token(), ['couponCode' => 'SHOWME']);

        $row = $this->withToken($this->ownerToken())
            ->getJson("/api/v1/owner/bookings/{$booking['id']}")->assertOk()->json('data');

        $this->assertSame(50.0, (float) $row['discountAmount']);
        $this->assertSame('คูปอง SHOWME', $row['discountLabel']);
    }

    /** The list view carries it too — the panel opens from a row. */
    public function test_the_owner_list_carries_the_breakdown(): void
    {
        $booking = $this->book($this->token());

        $rows = $this->withToken($this->ownerToken())
            ->getJson('/api/v1/owner/bookings?perPage=200')->assertOk()->json('data');

        $row = collect($rows)->firstWhere('id', $booking['id']);

        $this->assertArrayHasKey('discountAmount', $row);
        $this->assertArrayHasKey('paidAmount', $row);
        $this->assertArrayHasKey('outstandingAmount', $row);
    }
}
