<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\Organization;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * "จอง 07:00–16:00 ลด 10%" — the condition, enforced.
 *
 * A venue could write those hours in a promotion's title and nowhere else, so
 * the code came off a 20:00 peak booking exactly as happily as an empty Tuesday
 * morning. The venue was discounting its busiest hours and only the customer
 * knew.
 */
class CouponTimeConditionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function customerToken(): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => 'Uwindow',
            'displayName' => 'คุณเงื่อนไข',
        ])->json('token');
    }

    private function courtId(): string
    {
        return $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');
    }

    /** The venue's example: mornings and early afternoons only. */
    private function morningCoupon(array $attrs = []): Coupon
    {
        return Coupon::create(array_merge([
            'organization_id' => Organization::where('slug', 'everyday-badminton')->value('id'),
            'code' => 'MORNING10',
            'type' => 'percent',
            'value' => 10,
            'valid_from_time' => '07:00',
            'valid_to_time' => '16:00',
        ], $attrs));
    }

    private function book(string $token, string $start, string $end, string $date = '2026-11-18'): \Illuminate\Testing\TestResponse
    {
        $courtId = $this->courtId();
        $this->app['auth']->forgetGuards();

        return $this->withToken($token)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => $date,
            'start' => $start,
            'end' => $end,
            'couponCode' => 'MORNING10',
        ]);
    }

    // ---- the hours -------------------------------------------------------

    public function test_a_booking_inside_the_window_gets_the_discount(): void
    {
        $this->morningCoupon();

        $booking = $this->book($this->customerToken(), '09:00', '10:00')->assertCreated()->json('data');

        $this->assertSame(25.0, (float) $booking['discountAmount']);
    }

    public function test_a_booking_outside_the_window_is_refused(): void
    {
        $this->morningCoupon();

        $this->book($this->customerToken(), '20:00', '21:00')
            ->assertStatus(422)
            ->assertJsonPath('errors.couponCode.0', 'คูปองนี้ใช้ได้เฉพาะ ทุกวัน 07:00–16:00');
    }

    /**
     * The whole slot has to fit.
     *
     * 15:00–17:00 starts inside the window and ends an hour past it. Allowing
     * it would discount peak time the venue never offered — and "it started in
     * time" is not a rule anyone puts on a poster.
     */
    public function test_a_booking_that_runs_past_the_window_is_refused(): void
    {
        $this->morningCoupon();

        $this->book($this->customerToken(), '15:00', '17:00')->assertStatus(422);
    }

    public function test_a_booking_starting_before_the_window_is_refused(): void
    {
        $this->morningCoupon();

        $this->book($this->customerToken(), '06:00', '07:00')->assertStatus(422);
    }

    /** A coupon with no hours on it keeps behaving exactly as it always did. */
    public function test_a_coupon_without_a_condition_is_unaffected(): void
    {
        $this->morningCoupon(['code' => 'ANYTIME', 'valid_from_time' => null, 'valid_to_time' => null]);
        $courtId = $this->courtId();
        $token = $this->customerToken();
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => '2026-11-18',
            'start' => '20:00',
            'end' => '21:00',
            'couponCode' => 'ANYTIME',
        ])->assertCreated();
    }

    // ---- the days --------------------------------------------------------

    public function test_a_weekday_coupon_is_refused_at_the_weekend(): void
    {
        // 2026-11-18 is a Wednesday, 2026-11-21 a Saturday. The per-customer
        // limit is raised so the Saturday attempt is refused by the DAY rule —
        // at the default of 1 the Wednesday booking used the quota up and the
        // test passed while measuring nothing about weekends.
        $this->morningCoupon([
            'valid_from_time' => null,
            'valid_to_time' => null,
            'valid_days' => [1, 2, 3, 4, 5],
            'per_customer_limit' => 5,
        ]);

        $this->book($this->customerToken(), '09:00', '10:00', '2026-11-18')->assertCreated();

        $this->app['auth']->forgetGuards();
        $this->book($this->customerToken(), '09:00', '10:00', '2026-11-21')
            ->assertStatus(422)
            ->assertJsonPath('errors.couponCode.0', 'คูปองนี้ใช้ได้เฉพาะ จ. อ. พ. พฤ. ศ.');
    }

    // ---- the part that keeps this honest ---------------------------------

    /**
     * A caller that cannot say when the booking is gets REFUSED.
     *
     * Defaulting the other way is how a condition ends up enforced on the one
     * path somebody remembered and nowhere else — which is the same as not
     * enforcing it. The customer's coupon preview is exactly such a caller: it
     * runs before a slot is necessarily chosen.
     */
    public function test_a_preview_without_a_slot_refuses_a_conditional_coupon(): void
    {
        $this->morningCoupon();
        $token = $this->customerToken();
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/v1/coupons/preview', [
            'courtId' => $this->courtId(),
            'code' => 'MORNING10',
            'amount' => 250,
        ])->assertStatus(422);
    }

    public function test_a_preview_with_the_slot_answers_properly(): void
    {
        $this->morningCoupon();
        $token = $this->customerToken();
        $courtId = $this->courtId();
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/v1/coupons/preview', [
            'courtId' => $courtId,
            'code' => 'MORNING10',
            'amount' => 250,
            'date' => '2026-11-18',
            'start' => '09:00',
            'end' => '10:00',
        ])
            ->assertOk()
            ->assertJsonPath('discount', 25)
            // The rule travels with the answer, so the screen can repeat it
            // back instead of only showing a number.
            ->assertJsonPath('condition', 'ทุกวัน 07:00–16:00');
    }

    public function test_a_preview_with_a_slot_outside_the_window_is_refused(): void
    {
        $this->morningCoupon();
        $token = $this->customerToken();
        $courtId = $this->courtId();
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/v1/coupons/preview', [
            'courtId' => $courtId,
            'code' => 'MORNING10',
            'amount' => 250,
            'date' => '2026-11-18',
            'start' => '20:00',
            'end' => '21:00',
        ])->assertStatus(422);
    }
}
