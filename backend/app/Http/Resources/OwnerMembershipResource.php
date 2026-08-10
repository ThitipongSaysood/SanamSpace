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
            'customerId' => $this->customer_id ? (string) $this->customer_id : null,
            'customerName' => $this->customer?->display_name,
            'tier' => $this->tier,
            'memberId' => $this->member_id,
            'points' => (int) $this->points,
            'expiresAt' => $this->expires_on ? \App\Support\ThaiDate::short($this->expires_on) : null,
            'expiresOn' => $this->expires_on?->toDateString(),
            'lifetimePoints' => (int) ($this->lifetime_points ?? 0),
        ];
    }
}
