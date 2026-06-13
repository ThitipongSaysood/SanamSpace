<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Maps a Payment to the frontend `Payment` shape (lib/types.ts):
 * { id, bookingId, method, amount, status, slipUrl? }
 *
 * slipUrl is emitted only when present and is an absolute URL.
 */
class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'bookingId' => (string) $this->booking_id,
            'method' => $this->method,
            'amount' => (float) $this->amount,
            'status' => $this->status,
            $this->mergeWhen((bool) $this->slip_url, [
                'slipUrl' => $this->slip_url,
            ]),
        ];
    }
}
