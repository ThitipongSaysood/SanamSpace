<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Owner-portal view of a Payment: the customer-facing Payment fields plus a
 * booking summary and the customer name, so staff can action slips without
 * extra round-trips.
 *
 * Shape:
 * {
 *   id, bookingId, method, amount, status, slipUrl?,
 *   customerName,
 *   booking: { code, courtName, date, start, end }
 * }
 *
 * Expects the `booking.court` and `customer` relations to be loaded.
 */
class OwnerPaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $booking = $this->booking;

        return [
            'id' => (string) $this->id,
            'bookingId' => (string) $this->booking_id,
            'method' => $this->method,
            'amount' => (float) $this->amount,
            'status' => $this->status,
            'slipUrl' => $this->slip_url,
            'customerName' => $this->customer?->display_name,
            'booking' => $booking ? [
                'code' => $booking->code,
                'courtName' => $booking->court?->name,
                'date' => $booking->date,
                'start' => $booking->start,
                'end' => $booking->end,
            ] : null,
        ];
    }
}
