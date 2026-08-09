<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Coupon;
use App\Models\CouponRedemption;
use App\Models\Customer;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\OrganizationSetting;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Coupons and the member rate.
 *
 * The pricing line carried `// TODO: member discount / coupons` from the first
 * commit, so every booking was full price no matter who was booking it or what
 * the venue had promised them.
 */
class DiscountTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function customerToken(string $lineId = 'Udiscount'): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => $lineId,
            'displayName' => 'คุณส่วนลด',
        ])->json('token');
    }

    private function ownerToken(): string
    {
        $this->app['auth']->forgetGuards();

        $token = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');

        $this->app['auth']->forgetGuards();

        return $token;
    }

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    private function coupon(array $attrs = []): Coupon
    {
        return Coupon::create(array_merge([
            'organization_id' => $this->org()->id,
            'code' => 'SAVE10',
            'type' => 'percent',
            'value' => 10,
        ], $attrs));
    }

    private function book(string $token, array $extra = [], string $date = '2026-11-15'): array
    {
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');
        $this->app['auth']->forgetGuards();

        return $this->withToken($token)->postJson('/api/v1/bookings', array_merge([
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => $date,
            'start' => '18:00',
            'end' => '19:00',
        ], $extra))->json('data');
    }

    // ---- coupons ---------------------------------------------------------

    /** The basic promise: the code comes off the price. */
    public function test_a_percent_coupon_reduces_what_is_owed(): void
    {
        $this->coupon(['code' => 'SAVE10', 'type' => 'percent', 'value' => 10]);

        $booking = $this->book($this->customerToken(), ['couponCode' => 'SAVE10']);

        $this->assertSame(25.0, (float) $booking['discountAmount']); // 10% of 250
        $this->assertSame(225.0, (float) $booking['amount']);
        $this->assertSame('คูปอง SAVE10', $booking['discountLabel']);
    }

    /** Codes are typed by people, so case cannot be part of the identity. */
    public function test_a_coupon_code_is_case_insensitive(): void
    {
        $this->coupon(['code' => 'save10']);

        $booking = $this->book($this->customerToken(), ['couponCode' => 'SaVe10']);

        $this->assertSame(25.0, (float) $booking['discountAmount']);
    }

    /** A fixed code worth more than the booking is not a refund. */
    public function test_a_fixed_coupon_never_exceeds_the_booking(): void
    {
        $this->coupon(['code' => 'BIG', 'type' => 'fixed', 'value' => 5000]);

        $booking = $this->book($this->customerToken(), ['couponCode' => 'BIG']);

        $this->assertSame(250.0, (float) $booking['discountAmount']);
        $this->assertSame(0.0, (float) $booking['amount']);
    }

    /** A cap is how a venue runs "50% off, up to ฿100". */
    public function test_a_capped_percent_coupon_stops_at_the_cap(): void
    {
        $this->coupon(['code' => 'HALF', 'type' => 'percent', 'value' => 50, 'max_discount' => 100]);

        $booking = $this->book($this->customerToken(), ['couponCode' => 'HALF']);

        $this->assertSame(100.0, (float) $booking['discountAmount']); // not 125
    }

    /** A minimum stops a big code being spent on a small booking. */
    public function test_a_coupon_below_its_minimum_is_refused(): void
    {
        $this->coupon(['code' => 'BIGONLY', 'min_amount' => 1000]);

        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');
        $this->app['auth']->forgetGuards();

        $this->withToken($this->customerToken())->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => '2026-11-16',
            'start' => '18:00',
            'end' => '19:00',
            'couponCode' => 'BIGONLY',
        ])->assertStatus(422);
    }

    /** A typed code that does not exist is an error, not silently full price. */
    public function test_an_unknown_code_is_rejected_rather_than_ignored(): void
    {
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');
        $this->app['auth']->forgetGuards();

        $this->withToken($this->customerToken())->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => '2026-11-17',
            'start' => '18:00',
            'end' => '19:00',
            'couponCode' => 'NOPE',
        ])->assertStatus(422);
    }

    /** Expiry is the whole point of a campaign code. */
    public function test_an_expired_coupon_is_refused(): void
    {
        $this->coupon(['code' => 'OLD', 'ends_at' => now()->subDay()->toDateString()]);

        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');
        $this->app['auth']->forgetGuards();

        $this->withToken($this->customerToken())->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => '2026-11-18',
            'start' => '18:00',
            'end' => '19:00',
            'couponCode' => 'OLD',
        ])->assertStatus(422);
    }

    /** "One per customer" is the limit venues actually mean. */
    public function test_a_customer_cannot_use_a_one_per_person_code_twice(): void
    {
        $this->coupon(['code' => 'ONCE', 'per_customer_limit' => 1]);
        $token = $this->customerToken();

        $this->book($token, ['couponCode' => 'ONCE'], '2026-11-19');

        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => '2026-11-20',
            'start' => '18:00',
            'end' => '19:00',
            'couponCode' => 'ONCE',
        ])->assertStatus(422);
    }

    /** …but a different customer can still use it. */
    public function test_the_per_customer_limit_is_per_customer(): void
    {
        $this->coupon(['code' => 'ONCE', 'per_customer_limit' => 1]);

        $this->book($this->customerToken('Ufirst'), ['couponCode' => 'ONCE'], '2026-11-21');
        $second = $this->book($this->customerToken('Usecond'), ['couponCode' => 'ONCE'], '2026-11-22');

        $this->assertSame(25.0, (float) $second['discountAmount']);
    }

    /** A total cap closes the code for everyone. */
    public function test_a_total_usage_limit_closes_the_coupon(): void
    {
        $this->coupon(['code' => 'FIRST5', 'usage_limit' => 1, 'per_customer_limit' => 5]);

        $this->book($this->customerToken('Uone'), ['couponCode' => 'FIRST5'], '2026-11-23');

        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');
        $this->app['auth']->forgetGuards();

        $this->withToken($this->customerToken('Utwo'))->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => '2026-11-24',
            'start' => '18:00',
            'end' => '19:00',
            'couponCode' => 'FIRST5',
        ])->assertStatus(422);
    }

    /** Each use is recorded, so a cheaper booking can say why. */
    public function test_a_redemption_is_recorded_against_the_booking(): void
    {
        $coupon = $this->coupon(['code' => 'TRACK']);

        $booking = $this->book($this->customerToken(), ['couponCode' => 'TRACK']);

        $row = CouponRedemption::where('coupon_id', $coupon->id)->first();

        $this->assertNotNull($row);
        $this->assertSame($booking['id'], $row->booking_id);
        $this->assertSame(25.0, (float) $row->amount);
        $this->assertSame(1, (int) $coupon->fresh()->used_count);
    }

    /** Another venue's code is not this venue's code. */
    public function test_a_coupon_from_another_venue_cannot_be_used(): void
    {
        $tsr = Organization::where('slug', 'tsr-arena')->firstOrFail();
        Coupon::create([
            'organization_id' => $tsr->id,
            'code' => 'THEIRS',
            'type' => 'percent',
            'value' => 50,
        ]);

        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');
        $this->app['auth']->forgetGuards();

        $this->withToken($this->customerToken())->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => '2026-11-25',
            'start' => '18:00',
            'end' => '19:00',
            'couponCode' => 'THEIRS',
        ])->assertStatus(422);
    }

    // ---- member discount --------------------------------------------------

    /** A standing rate needs no code at all. */
    public function test_a_members_tier_discount_applies_without_a_code(): void
    {
        OrganizationSetting::query()->updateOrCreate(
            ['organization_id' => $this->org()->id],
            ['member_discounts' => ['Gold' => 20]],
        );

        $token = $this->customerToken();
        $customer = Customer::where('line_user_id', 'Udiscount')->firstOrFail();
        Membership::create([
            'organization_id' => $customer->organization_id,
            'customer_id' => $customer->id,
            'tier' => 'Gold',
            'member_id' => 'MB-D-1',
            'points' => 0,
            'expires_on' => now()->addYear(),
        ]);

        $booking = $this->book($token);

        $this->assertSame(50.0, (float) $booking['discountAmount']); // 20% of 250
        $this->assertSame('ส่วนลดสมาชิก Gold', $booking['discountLabel']);
    }

    /** Tier names are the venue's own text, so matching is case-insensitive. */
    public function test_the_tier_name_is_matched_the_way_a_person_would(): void
    {
        OrganizationSetting::query()->updateOrCreate(
            ['organization_id' => $this->org()->id],
            ['member_discounts' => ['gold' => 20]],
        );

        $token = $this->customerToken();
        $customer = Customer::where('line_user_id', 'Udiscount')->firstOrFail();
        Membership::create([
            'organization_id' => $customer->organization_id,
            'customer_id' => $customer->id,
            'tier' => 'GOLD',
            'member_id' => 'MB-D-2',
            'points' => 0,
            'expires_on' => now()->addYear(),
        ]);

        $this->assertSame(50.0, (float) $this->book($token)['discountAmount']);
    }

    /**
     * They do not stack — that is how a venue gives away 60% by accident. The
     * bigger one wins, so a member is never worse off for being a member.
     */
    public function test_a_coupon_and_a_member_rate_do_not_stack(): void
    {
        OrganizationSetting::query()->updateOrCreate(
            ['organization_id' => $this->org()->id],
            ['member_discounts' => ['Gold' => 20]],
        );
        $this->coupon(['code' => 'SMALL', 'type' => 'percent', 'value' => 5]);

        $token = $this->customerToken();
        $customer = Customer::where('line_user_id', 'Udiscount')->firstOrFail();
        Membership::create([
            'organization_id' => $customer->organization_id,
            'customer_id' => $customer->id,
            'tier' => 'Gold',
            'member_id' => 'MB-D-3',
            'points' => 0,
            'expires_on' => now()->addYear(),
        ]);

        $booking = $this->book($token, ['couponCode' => 'SMALL']);

        // The member rate is worth more, so it wins and the code is not spent.
        $this->assertSame(50.0, (float) $booking['discountAmount']);
        $this->assertSame('ส่วนลดสมาชิก Gold', $booking['discountLabel']);
        $this->assertSame(0, CouponRedemption::count());
    }

    // ---- the rest of the flow --------------------------------------------

    /** The deposit is a share of what is actually payable, not the list price. */
    public function test_the_deposit_is_calculated_after_the_discount(): void
    {
        OrganizationSetting::query()->updateOrCreate(
            ['organization_id' => $this->org()->id],
            ['deposit_enabled' => true, 'deposit_type' => 'percent', 'deposit_value' => 50],
        );
        $this->coupon(['code' => 'SAVE10']);

        $booking = $this->book($this->customerToken(), ['couponCode' => 'SAVE10']);

        $this->assertSame(225.0, (float) $booking['amount']);
        $this->assertSame(112.5, (float) $booking['depositAmount']); // 50% of 225
    }

    /** The customer can see what a code does before committing to the booking. */
    public function test_a_code_can_be_previewed(): void
    {
        $this->coupon(['code' => 'SAVE10']);
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');
        $this->app['auth']->forgetGuards();

        $body = $this->withToken($this->customerToken())->postJson('/api/v1/coupons/preview', [
            'courtId' => $courtId,
            'code' => 'save10',
            'amount' => 250,
        ])->assertOk()->json();

        $this->assertSame('SAVE10', $body['code']);
        $this->assertSame(25.0, (float) $body['discount']);
        $this->assertSame(225.0, (float) $body['payable']);
    }

    /** Previewing a bad code says why, while it can still be fixed. */
    public function test_previewing_an_expired_code_explains_itself(): void
    {
        $this->coupon(['code' => 'OLD', 'ends_at' => now()->subDay()->toDateString()]);
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');
        $this->app['auth']->forgetGuards();

        $this->withToken($this->customerToken())->postJson('/api/v1/coupons/preview', [
            'courtId' => $courtId, 'code' => 'OLD', 'amount' => 250,
        ])->assertStatus(422)->assertJsonValidationErrors('couponCode');
    }

    /** The venue manages its own codes, and only its own. */
    public function test_the_owner_can_manage_coupons(): void
    {
        $token = $this->ownerToken();

        $created = $this->withToken($token)->postJson('/api/v1/owner/coupons', [
            'code' => 'newyear',
            'type' => 'percent',
            'value' => 15,
            'perCustomerLimit' => 2,
        ])->assertCreated()->json('data');

        $this->assertSame('NEWYEAR', $created['code'], 'stored uppercase');

        $this->withToken($token)->putJson("/api/v1/owner/coupons/{$created['id']}", ['value' => 20])
            ->assertOk()
            ->assertJsonPath('data.value', 20);

        $this->withToken($token)->deleteJson("/api/v1/owner/coupons/{$created['id']}")->assertNoContent();
    }

    /** One code per venue — a duplicate would make redemption ambiguous. */
    public function test_a_duplicate_code_in_the_same_venue_is_refused(): void
    {
        $this->coupon(['code' => 'DUP']);

        $this->withToken($this->ownerToken())->postJson('/api/v1/owner/coupons', [
            'code' => 'dup',
            'value' => 5,
        ])->assertStatus(422);
    }
}
