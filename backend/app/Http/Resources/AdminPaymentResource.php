<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdminPaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'organizationName' => $this->organization?->name,
            'customerName' => $this->customer?->display_name,
            'bookingCode' => $this->booking?->code,
            'method' => $this->method,
            'amount' => (float) $this->amount,
            'status' => $this->status,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
