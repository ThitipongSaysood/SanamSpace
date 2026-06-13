<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Owner-portal (list) view of a Membership joined to its customer.
 *
 * Shape: { id, customerName, tier, memberId, points, expiresAt }
 *
 * Expects the `customer` relation to be loaded.
 */
class OwnerMembershipResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'customerName' => $this->customer?->display_name,
            'tier' => $this->tier,
            'memberId' => $this->member_id,
            'points' => (int) $this->points,
            'expiresAt' => $this->expires_at,
        ];
    }
}
