<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\CouponRedemption;
use App\Models\Customer;
use App\Models\OrganizationSetting;
use App\Support\BookingWindow;
use Illuminate\Validation\ValidationException;

/**
 * What comes off the price, and why.
 *
 * Two kinds, deliberately kept apart: a coupon is a campaign the customer opts
 * into by typing a code, a member discount is a standing rate the venue gives
 * its tiers. They are not combined — stacking them is how a venue accidentally
 * gives away 60%, and a venue that wants that can set the tier rate to match.
 * The larger of the two wins, so the customer is never worse off for having a
 * membership.
 */
class DiscountService
{
    /**
     * @return array{amount: float, label: ?string, coupon: ?Coupon}
     */
    public function resolve(
        string $orgId,
        float $amount,
        ?Customer $customer,
        ?string $code,
        ?OrganizationSetting $settings = null,
        ?BookingWindow $window = null,
    ): array {
        $none = ['amount' => 0.0, 'label' => null, 'coupon' => null];

        if ($amount <= 0) {
            return $none;
        }

        $member = $this->memberDiscount($amount, $customer, $settings);

        if (blank($code)) {
            return $member;
        }

        // A typed code is an explicit request, so a bad one is an error rather
        // than something to quietly ignore and charge full price for.
        $coupon = $this->findUsable($orgId, $code, $amount, $customer, $window);
        $couponAmount = $this->cap($coupon, $amount);

        if ($couponAmount >= $member['amount']) {
            return [
                'amount' => $couponAmount,
                'label' => "คูปอง {$coupon->code}",
                'coupon' => $coupon,
            ];
        }

        return $member;
    }

    /** The venue's standing rate for this customer's tier, if any. */
    private function memberDiscount(float $amount, ?Customer $customer, ?OrganizationSetting $settings): array
    {
        $none = ['amount' => 0.0, 'label' => null, 'coupon' => null];

        $tier = $customer?->membership?->tier;
        $rates = $settings?->member_discounts;

        if (! $tier || ! is_array($rates)) {
            return $none;
        }

        // Tier names are the venue's own text ("Gold", "gold"), so match the
        // way a person would rather than the way a hash lookup would.
        $percent = null;
        foreach ($rates as $key => $value) {
            if (mb_strtolower((string) $key) === mb_strtolower((string) $tier)) {
                $percent = (float) $value;
                break;
            }
        }

        if (! $percent || $percent <= 0) {
            return $none;
        }

        return [
            'amount' => round($amount * min($percent, 100) / 100, 2),
            'label' => "ส่วนลดสมาชิก {$tier}",
            'coupon' => null,
        ];
    }

    /** Find a coupon this customer may actually use right now, or explain why not. */
    public function findUsable(
        string $orgId,
        string $code,
        float $amount,
        ?Customer $customer,
        ?BookingWindow $window = null,
    ): Coupon {
        $coupon = Coupon::query()
            ->forOrganization($orgId)
            ->whereRaw('UPPER(code) = ?', [mb_strtoupper(trim($code))])
            ->first();

        if (! $coupon || ! $coupon->is_active) {
            throw ValidationException::withMessages(['couponCode' => 'ไม่พบคูปองนี้']);
        }

        $today = now()->toDateString();

        if ($coupon->starts_at && $today < $coupon->starts_at->toDateString()) {
            throw ValidationException::withMessages(['couponCode' => 'คูปองนี้ยังไม่เริ่มใช้']);
        }

        if ($coupon->ends_at && $today > $coupon->ends_at->toDateString()) {
            throw ValidationException::withMessages(['couponCode' => 'คูปองนี้หมดอายุแล้ว']);
        }

        if ($coupon->min_amount > 0 && $amount < (float) $coupon->min_amount) {
            $min = number_format((float) $coupon->min_amount, 0);
            throw ValidationException::withMessages([
                'couponCode' => "คูปองนี้ใช้ได้เมื่อยอดตั้งแต่ ฿{$min}",
            ]);
        }

        if ($coupon->usage_limit !== null && $coupon->used_count >= $coupon->usage_limit) {
            throw ValidationException::withMessages(['couponCode' => 'คูปองนี้ถูกใช้ครบแล้ว']);
        }

        if ($customer && $coupon->per_customer_limit > 0) {
            $mine = CouponRedemption::query()
                ->where('coupon_id', $coupon->id)
                ->where('customer_id', $customer->id)
                ->count();

            if ($mine >= $coupon->per_customer_limit) {
                throw ValidationException::withMessages(['couponCode' => 'คุณใช้คูปองนี้ครบแล้ว']);
            }
        }

        $this->assertWindowAllows($coupon, $window);

        return $coupon;
    }

    /**
     * Does the booking fall inside the hours this coupon is for?
     *
     * A venue running "จอง 07:00–16:00 ลด 10%" used to keep that condition in
     * the promotion's title, where nothing could read it — so the code came off
     * a 20:00 peak booking exactly as happily as an empty Tuesday morning.
     *
     * **A caller that cannot say when the booking is gets refused, not waved
     * through.** Defaulting the other way is how a condition ends up enforced
     * on the one path somebody remembered and nowhere else, which is the same
     * as not enforcing it at all.
     *
     * The WHOLE booking must fit. A 15:00–17:00 slot against a 07:00–16:00
     * coupon is refused: the venue offered its quiet hours, and half of that
     * session is peak time it never meant to discount.
     */
    private function assertWindowAllows(Coupon $coupon, ?BookingWindow $window): void
    {
        if (! $coupon->hasTimeCondition()) {
            return;
        }

        if (! $window) {
            throw ValidationException::withMessages([
                'couponCode' => 'คูปองนี้ใช้ได้เฉพาะบางช่วงเวลา — เลือกวันและเวลาที่จองก่อน',
            ]);
        }

        $days = $coupon->valid_days;

        if (filled($days) && ! in_array($window->isoWeekday(), array_map('intval', $days), true)) {
            throw ValidationException::withMessages([
                'couponCode' => 'คูปองนี้ใช้ได้เฉพาะ '.$coupon->conditionLabel(),
            ]);
        }

        $from = $coupon->valid_from_time;
        $to = $coupon->valid_to_time;

        // String comparison on HH:MM, the same shape bookings store. Both ends
        // are checked against the booking's own ends so a slot that starts in
        // range but runs past the window is refused rather than half-priced.
        $tooEarly = filled($from) && $window->start < $from;
        $tooLate = filled($to) && $window->end > $to;

        if ($tooEarly || $tooLate) {
            throw ValidationException::withMessages([
                'couponCode' => 'คูปองนี้ใช้ได้เฉพาะ '.$coupon->conditionLabel(),
            ]);
        }
    }

    /**
     * What this coupon is worth against this amount.
     *
     * Never more than the booking: a ฿200 code on a ฿150 court is ฿150 off, not
     * a ฿50 refund.
     */
    public function cap(Coupon $coupon, float $amount): float
    {
        $raw = $coupon->type === 'fixed'
            ? (float) $coupon->value
            : $amount * ((float) $coupon->value / 100);

        if ($coupon->max_discount !== null) {
            $raw = min($raw, (float) $coupon->max_discount);
        }

        return round(min($raw, $amount), 2);
    }

    /** Record that it was used. Called inside the booking's own transaction. */
    public function redeem(Coupon $coupon, ?Customer $customer, string $bookingId, float $amount): void
    {
        CouponRedemption::create([
            'coupon_id' => $coupon->id,
            'customer_id' => $customer?->id,
            'booking_id' => $bookingId,
            'amount' => $amount,
        ]);

        $coupon->increment('used_count');
    }
}
