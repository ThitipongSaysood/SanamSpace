<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Court;
use App\Services\DiscountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * "What would this code do?" — asked before committing to the booking.
 *
 * Without this the customer types a code, taps book, and finds out on the
 * receipt. A preview also means a bad code is rejected while they can still fix
 * it rather than after a court has been held.
 */
class CouponController extends Controller
{
    public function preview(Request $request, DiscountService $discounts): JsonResponse
    {
        $data = $request->validate([
            'courtId' => ['required', 'string'],
            'code' => ['required', 'string', 'max:40'],
            'amount' => ['required', 'numeric', 'min:0'],
        ]);

        $court = Court::query()->with('branch')->findOrFail($data['courtId']);
        $amount = (float) $data['amount'];

        // Throws a readable validation error when the code cannot be used —
        // the reason is the useful part, not a bare "invalid".
        $coupon = $discounts->findUsable(
            $court->organization_id,
            $data['code'],
            $amount,
            $request->user(),
        );

        $discount = $discounts->cap($coupon, $amount);

        return response()->json([
            'code' => $coupon->code,
            'description' => $coupon->description,
            'discount' => $discount,
            'payable' => round($amount - $discount, 2),
        ]);
    }
}
