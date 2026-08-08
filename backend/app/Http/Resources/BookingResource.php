<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Maps a Booking to the frontend `Booking` shape (lib/types.ts):
 * { id, code, venueId, venueName, courtId, courtName, date, start, end, amount, status, createdAt }
 *
 * venueId is the organization slug (matching the Venue id used elsewhere).
 *
 * `customerName` is emitted only when the `customer` relation is loaded (e.g.
 * owner-portal listings); it is omitted for customer-facing responses.
 */
class BookingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'code' => $this->code,
            'venueId' => $this->branch?->organization?->slug ?? $this->branch_id,
            'venueName' => $this->branch?->name ?? $this->branch?->organization?->name,
            'courtId' => (string) $this->court_id,
            'courtName' => $this->court?->name,
            'date' => $this->date,
            'start' => $this->start,
            'end' => $this->end,
            // The grand total the customer transfers, plus the parts it is
            // made of — a "why is it 550 not 500" answer, not a bare number.
            'amount' => (float) $this->amount,
            'courtAmount' => (float) ($this->court_amount ?? $this->amount),
            'rentalTotal' => (float) ($this->rental_total ?? 0),
            'rentals' => $this->whenLoaded('rentals', fn () => $this->rentals->map(fn ($r) => [
                'id' => (string) $r->id,
                'name' => $r->name,
                'unitPrice' => (float) $r->unit_price,
                'priceUnit' => $r->price_unit,
                'quantity' => (int) $r->quantity,
                'lineTotal' => (float) $r->line_total,
            ])->values(), []),
            'status' => $this->status,
            'createdAt' => $this->created_at?->toIso8601String(),
            // Booking status alone cannot tell "not paid yet" from "slip sent,
            // waiting for the venue" — both sit at pending_payment, and the app
            // was asking people to pay a second time because of it.
            'paymentStatus' => $this->whenLoaded('latestPayment', fn () => $this->latestPayment?->status),
            'paymentId' => $this->whenLoaded('latestPayment', fn () => $this->latestPayment?->id),
            // What the customer's QR encodes, and when the counter scanned it.
            'checkinToken' => $this->checkin_token,
            'checkedInAt' => $this->checked_in_at?->toIso8601String(),
            $this->mergeWhen($this->relationLoaded('customer'), fn () => [
                'customerName' => $this->customer?->display_name,
            ]),
        ];
    }
}
