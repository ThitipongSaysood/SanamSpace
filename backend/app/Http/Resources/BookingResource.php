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
            'amount' => (float) $this->amount,
            'status' => $this->status,
            'createdAt' => $this->created_at?->toIso8601String(),
            // What the customer's QR encodes, and when the counter scanned it.
            'checkinToken' => $this->checkin_token,
            'checkedInAt' => $this->checked_in_at?->toIso8601String(),
            $this->mergeWhen($this->relationLoaded('customer'), fn () => [
                'customerName' => $this->customer?->display_name,
            ]),
        ];
    }
}
