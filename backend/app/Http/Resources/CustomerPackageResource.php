<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerPackageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'totalHours' => (float) $this->total_hours,
            'remainingHours' => (float) $this->remaining_hours,
            'price' => (float) $this->price,
            'validDays' => (int) $this->valid_days,
            'status' => $this->status,
            'expiresAt' => $this->expires_at?->toDateString(),
        ];
    }
}
