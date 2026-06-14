<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Branch (สนาม/สาขา) shape for the Owner Portal management UI — exposes the
 * real branch id, status (active/inactive = เปิด/ปิด) and editable fields.
 * Distinct from the customer-facing VenueResource (which keys off the org slug).
 */
class OwnerBranchResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'address' => $this->address,
            'phone' => $this->phone,
            'openTime' => $this->open_time ? substr((string) $this->open_time, 0, 5) : null,
            'closeTime' => $this->close_time ? substr((string) $this->close_time, 0, 5) : null,
            'status' => $this->status,
            'sports' => $this->sports ?? [],
            'facilities' => $this->facilities ?? [],
            'imageUrl' => $this->image_url,
            'description' => $this->description,
            'courtCount' => (int) ($this->courts_count ?? 0),
        ];
    }
}
