<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Owner-portal view of a Customer:
 * { id, displayName, phone, email, totalSpending, visits, bookingsCount }
 *
 * `bookingsCount` is read from the `bookings_count` withCount aggregate when
 * present, otherwise 0.
 */
class OwnerCustomerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'displayName' => $this->display_name,
            'phone' => $this->phone,
            'email' => $this->email,
            'totalSpending' => (float) $this->total_spending,
            'visits' => (int) $this->visits,
            'bookingsCount' => (int) ($this->bookings_count ?? 0),
            // Two different things, deliberately not added together: credit is
            // hours of court time, the wallet is baht. Converting one to the
            // other needs a rate nobody has agreed on.
            'creditHours' => (float) ($this->credit_hours ?? 0),
            'walletBalance' => (float) ($this->wallet?->balance ?? 0),
        ];
    }
}
