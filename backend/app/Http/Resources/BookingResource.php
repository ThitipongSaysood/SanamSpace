<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Maps a Booking to the frontend `Booking` shape (lib/types.ts):
 * { id, code, venueId, venueName, courtId, courtName, date, start, end, amount, status, createdAt }
 *
 * venueId is the organization slug (matching the Venue id used elsewhere).
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
        ];
    }
}
