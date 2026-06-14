<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Court shape for the Owner Portal management UI — exposes the real court id,
 * its branch, status (active/inactive = เปิด/ปิด) and editable spec fields.
 * Distinct from the customer-facing CourtResource (which keys off the org slug).
 */
class OwnerCourtResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'branchId' => $this->branch_id,
            'branchName' => $this->whenLoaded('branch', fn () => $this->branch?->name),
            'name' => $this->name,
            'sport' => $this->sport,
            'pricePerHour' => (float) $this->price_per_hour,
            'imageUrl' => $this->image_url,
            'status' => $this->status,
            'sortOrder' => (int) $this->sort_order,
            'spec' => [
                'floor' => $this->floor,
                'aircon' => $this->aircon,
                'height' => $this->height,
                'lighting' => $this->lighting,
                'standard' => $this->standard,
                'players' => $this->players,
            ],
        ];
    }
}
