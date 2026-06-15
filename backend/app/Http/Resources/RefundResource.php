<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Maps a Refund to the frontend `Refund` shape (lib/types.ts):
 * { id, bookingId, bookingCode?, amount, reason?, status, method?, requestedBy, note?, createdAt, processedAt? }
 *
 * `bookingCode` requires the `booking` relation to be loaded.
 */
class RefundResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'bookingId' => (string) $this->booking_id,
            'bookingCode' => $this->booking?->code,
            'amount' => (float) $this->amount,
            'reason' => $this->reason,
            'status' => $this->status,
            'method' => $this->method,
            'requestedBy' => $this->requested_by,
            'note' => $this->note,
            'createdAt' => $this->created_at?->toIso8601String(),
            'processedAt' => $this->processed_at?->toIso8601String(),
        ];
    }
}
