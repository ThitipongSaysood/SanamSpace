<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\BookingRental;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Getting the gear back.
 *
 * Counter work, not catalogue work: this is someone at the desk handing back a
 * racket, so it sits behind `booking.checkin` alongside the other things the
 * front desk does — not behind `rental.manage`, which is for changing what the
 * venue owns.
 */
class RentalReturnController extends Controller
{
    /**
     * POST /owner/bookings/{bookingId}/rentals/{rentalId}/return — { quantity }
     *
     * Partial by design. Two rackets out and one back is a real counter moment,
     * and a control that can only say "all of it" gets used wrongly or not at
     * all.
     */
    public function store(Request $request, string $bookingId, string $rentalId): BookingResource
    {
        $booking = $this->findScoped($request, $bookingId);

        /** @var BookingRental $line */
        $line = $booking->rentals()->where('id', $rentalId)->firstOrFail();

        $data = $request->validate([
            'quantity' => ['nullable', 'integer', 'min:1'],
        ]);

        // No number means "all of what is still out" — the common case, and the
        // one a busy counter should not have to type.
        $quantity = $data['quantity'] ?? $line->outstandingQty();

        if ($line->outstandingQty() === 0) {
            throw ValidationException::withMessages([
                'quantity' => "{$line->name} รับคืนครบแล้ว",
            ]);
        }

        if ($quantity > $line->outstandingQty()) {
            throw ValidationException::withMessages([
                'quantity' => "{$line->name} ค้างอยู่ {$line->outstandingQty()} ชิ้น รับคืน {$quantity} ไม่ได้",
            ]);
        }

        $returned = (int) $line->returned_qty + $quantity;

        $line->update([
            'returned_qty' => $returned,
            // Stamped only when the line is complete: "returned_at" on a
            // half-returned line would read as done.
            'returned_at' => $returned >= $line->quantity ? now() : null,
        ]);

        return new BookingResource($booking->fresh()->load([
            'branch.organization', 'court', 'customer', 'rentals', 'latestPayment',
        ]));
    }

    /**
     * GET /owner/rentals/outstanding — what is still out.
     *
     * Only bookings whose slot has already ended: gear on a court right now is
     * not missing, it is in use. Cancelled bookings never had it.
     */
    public function outstanding(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $now = now();

        $lines = BookingRental::query()
            ->whereColumn('returned_qty', '<', 'quantity')
            ->whereHas('booking', function ($q) use ($orgId, $now) {
                $q->where('organization_id', $orgId)
                    ->where('status', '!=', 'cancelled')
                    ->where(fn ($b) => $b->where('date', '<', $now->toDateString())
                        ->orWhere(fn ($same) => $same->where('date', $now->toDateString())
                            ->where('end', '<=', $now->format('H:i'))));
            })
            ->with(['booking.customer', 'booking.court'])
            ->get()
            ->map(fn (BookingRental $l) => [
                'id' => (string) $l->id,
                'bookingId' => (string) $l->booking_id,
                'bookingCode' => $l->booking?->code,
                'customerId' => $l->booking?->customer?->id,
                'customerName' => $l->booking?->customer?->display_name ?? 'Walk-in',
                'courtName' => $l->booking?->court?->name,
                'date' => $l->booking?->date,
                'start' => $l->booking?->start,
                'end' => $l->booking?->end,
                'name' => $l->name,
                'quantity' => (int) $l->quantity,
                'returnedQty' => (int) $l->returned_qty,
                'outstandingQty' => $l->outstandingQty(),
            ])
            ->sortBy(fn ($r) => "{$r['date']}T{$r['start']}")
            ->values();

        return response()->json(['data' => $lines]);
    }

    private function findScoped(Request $request, string $id): Booking
    {
        return Booking::query()
            ->forOrganization($request->attributes->get('currentOrganizationId'))
            ->where('id', $id)
            ->firstOrFail();
    }
}
