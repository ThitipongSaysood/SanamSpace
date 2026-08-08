<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\CouponRedemption;
use App\Models\Customer;
use App\Models\OrganizationSetting;
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
        $coupon = $this->findUsable($orgId, $code, $amount, $customer);
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
    public function findUsable(string $orgId, string $code, float $amount, ?Customer $customer): Coupon
    {
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

        return $coupon;
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
