<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Coupon;
use App\Models\FlashSale;
use App\Models\Organization;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A flash sale takes itself off the court price, by the hour.
 *
 * No code typed: the venue drops its price on chosen hours and the booking is
 * charged the lower amount. The discount is per-hour (a booking half inside the
 * window is half discounted), scoped to chosen courts, snapshotted onto the
 * booking, and never stacks with a coupon — the larger wins.
 */
class FlashSaleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function orgId(): string
    {
        return Organization::where('slug', 'everyday-badminton')->value('id');
    }

    private function customerToken(string $line = 'Uflash'): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => $line,
            'displayName' => 'คุณแฟลช',
        ])->json('token');
    }

    /** @return array{id:string, price:float} */
    private function court(int $i = 0): array
    {
        $c = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json("data.{$i}");

        return ['id' => $c['id'], 'price' => (float) $c['pricePerHour']];
    }

    /** 20% off, every day 13:00–16:00, whole venue. */
    private function afternoonSale(array $attrs = []): FlashSale
    {
        return FlashSale::create(array_merge([
            'organization_id' => $this->orgId(),
            'name' => 'ลดช่วงบ่าย',
            'discount_type' => 'percent',
            'discount_value' => 20,
            'valid_from_time' => '13:00',
            'valid_to_time' => '16:00',
            'is_active' => true,
        ], $attrs));
    }

    private function book(string $token, string $courtId, string $start, string $end, array $extra = []): \Illuminate\Testing\TestResponse
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token)->postJson('/api/v1/bookings', array_merge([
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => '2026-11-18',
            'start' => $start,
            'end' => $end,
        ], $extra));
    }

    public function test_a_booking_inside_the_window_is_discounted_and_snapshotted(): void
    {
        $this->afternoonSale();
        $court = $this->court();

        $data = $this->book($this->customerToken(), $court['id'], '14:00', '15:00')
            ->assertCreated()->json('data');

        $this->assertEqualsWithDelta($court['price'] * 0.2, (float) $data['discountAmount'], 0.01);
        $this->assertEqualsWithDelta($court['price'] * 0.8, (float) $data['amount'], 0.01);
        $this->assertStringStartsWith('⚡', $data['discountLabel']);
        $this->assertNotNull(Booking::find($data['id'])->flash_sale_id);
    }

    public function test_only_the_hours_inside_the_window_are_discounted(): void
    {
        $this->afternoonSale();
        $court = $this->court();

        // 15:00–17:00: the 15:00 hour is on sale, the 16:00 hour is not.
        $data = $this->book($this->customerToken(), $court['id'], '15:00', '17:00')
            ->assertCreated()->json('data');

        $this->assertEqualsWithDelta($court['price'] * 0.2, (float) $data['discountAmount'], 0.01);
        $this->assertEqualsWithDelta($court['price'] * 2 - $court['price'] * 0.2, (float) $data['amount'], 0.01);
    }

    public function test_a_booking_outside_the_window_pays_full_price(): void
    {
        $this->afternoonSale();
        $court = $this->court();

        $data = $this->book($this->customerToken(), $court['id'], '18:00', '19:00')
            ->assertCreated()->json('data');

        $this->assertEquals(0.0, (float) $data['discountAmount']);
        $this->assertEqualsWithDelta($court['price'], (float) $data['amount'], 0.01);
        $this->assertNull(Booking::find($data['id'])->flash_sale_id);
    }

    public function test_a_sale_scoped_to_another_court_does_not_apply(): void
    {
        $sale = $this->afternoonSale();
        $other = $this->court(1);
        $sale->scopes()->create(['court_id' => $other['id']]);

        $court = $this->court(0);
        $data = $this->book($this->customerToken(), $court['id'], '14:00', '15:00')
            ->assertCreated()->json('data');

        $this->assertEquals(0.0, (float) $data['discountAmount']);
    }

    public function test_the_larger_of_a_flash_sale_and_a_coupon_wins(): void
    {
        $this->afternoonSale(['discount_value' => 20]); // 20% flash
        Coupon::create([
            'organization_id' => $this->orgId(),
            'code' => 'SMALL5',
            'type' => 'percent',
            'value' => 5, // a weaker coupon
        ]);
        $court = $this->court();

        // In the flash window, typing the weaker coupon: flash still wins.
        $data = $this->book($this->customerToken(), $court['id'], '14:00', '15:00', ['couponCode' => 'SMALL5'])
            ->assertCreated()->json('data');

        $this->assertEqualsWithDelta($court['price'] * 0.2, (float) $data['discountAmount'], 0.01);
        $this->assertStringStartsWith('⚡', $data['discountLabel']);
        $this->assertNotNull(Booking::find($data['id'])->flash_sale_id);
    }

    public function test_an_inactive_sale_does_nothing(): void
    {
        $this->afternoonSale(['is_active' => false]);
        $court = $this->court();

        $data = $this->book($this->customerToken(), $court['id'], '14:00', '15:00')
            ->assertCreated()->json('data');

        $this->assertEquals(0.0, (float) $data['discountAmount']);
    }
}
