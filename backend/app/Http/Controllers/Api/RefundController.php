<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\RefundResource;
use App\Models\Booking;
use App\Models\Refund;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;

/**
 * Customer-facing refunds: the customer REQUESTS a refund for their own paid
 * booking and lists their requests. Owner/Admin approve or reject later (those
 * live in Api/Owner and Api/Admin and run the shared RefundService).
 *
 * A request is created `status=requested, requested_by=customer`. It is gated so
 * a customer can only refund a paid/active booking they own, and never twice.
 */
class RefundController extends Controller
{
    /**
     * POST /bookings/{bookingId}/refund { reason? } -> Refund (201).
     */
    public function store(Request $request, string $bookingId): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        // Scope to the authed customer (mirrors BookingController::findOwned).
        // 404 when the booking isn't theirs, so customers can't probe others'.
        $booking = Booking::query()
            ->where('id', $bookingId)
            ->where('customer_id', $request->user()->id)
            ->firstOrFail();

        // Eligibility: the booking must be paid/active.
        $approvedPayment = $booking->payments()
            ->where('status', 'approved')
            ->latest('created_at')
            ->first();

        $isPaid = $approvedPayment !== null
            || ((float) $booking->amount > 0 && in_array($booking->status, ['confirmed', 'completed'], true));

        if (! $isPaid) {
            throw ValidationException::withMessages([
                'booking' => 'ขอคืนเงินได้เฉพาะรายการที่ชำระเงินแล้วเท่านั้น',
            ]);
        }

        // No duplicate while an earlier request is still open/approved.
        $hasOpenRefund = $booking->refunds()
            ->whereIn('status', ['requested', 'approved'])
            ->exists();

        if ($hasOpenRefund) {
            throw ValidationException::withMessages([
                'booking' => 'มีคำขอคืนเงินสำหรับรายการนี้อยู่แล้ว',
            ]);
        }

        $refund = Refund::create([
            'organization_id' => $booking->organization_id,
            'booking_id' => $booking->id,
            'payment_id' => $approvedPayment?->id,
            'customer_id' => $request->user()->id,
            'amount' => $booking->amount,
            'reason' => $data['reason'] ?? null,
            'status' => 'requested',
            'requested_by' => 'customer',
        ]);

        $refund->setRelation('booking', $booking);

        return (new RefundResource($refund))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * GET /refunds -> Refund[] (current customer's refunds, newest first).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $refunds = Refund::query()
            ->with('booking')
            ->where('customer_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->get();

        return RefundResource::collection($refunds);
    }
}
