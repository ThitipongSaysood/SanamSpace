<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Court;
use App\Services\DiscountService;
use App\Support\BookingWindow;
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
            // The slot being previewed. Optional in the rules because an older
            // client may not send it — but a coupon with an hours condition
            // refuses when it is missing rather than being given away.
            'date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'start' => ['sometimes', 'nullable', 'string', 'max:5'],
            'end' => ['sometimes', 'nullable', 'string', 'max:5'],
        ]);

        $court = Court::query()->with('branch')->findOrFail($data['courtId']);

        // Tenant isolation: only a venue's own customers may preview its coupons.
        // The court is fetched by id alone, so without this a venue A customer
        // could submit venue B's court id and probe venue B's coupon codes.
        abort_if($court->organization_id !== $request->user()->organization_id, 404);

        $amount = (float) $data['amount'];

        // Throws a readable validation error when the code cannot be used —
        // the reason is the useful part, not a bare "invalid".
        $coupon = $discounts->findUsable(
            $court->organization_id,
            $data['code'],
            $amount,
            $request->user(),
            BookingWindow::tryFrom($data['date'] ?? null, $data['start'] ?? null, $data['end'] ?? null),
        );

        $discount = $discounts->cap($coupon, $amount);

        return response()->json([
            'code' => $coupon->code,
            'description' => $coupon->description,
            // What the customer had to satisfy to get this, so the preview can
            // repeat the rule back rather than only the number.
            'condition' => $coupon->conditionLabel(),
            'discount' => $discount,
            'payable' => round($amount - $discount, 2),
        ]);
    }
}
