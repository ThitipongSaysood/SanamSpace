<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One customer, as the venue's staff need them at the counter: who they are,
 * what they are worth, and what they have booked.
 *
 * The list view (OwnerCustomerResource) stays deliberately thin — this is the
 * only place that pays for the extra joins.
 */
class OwnerCustomerDetailResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $bookings = $this->whenLoaded('bookings');

        return [
            'id' => (string) $this->id,
            'displayName' => $this->display_name,
            'phone' => $this->phone,
            'email' => $this->email,
            'pictureUrl' => $this->picture_url,
            'totalSpending' => (float) $this->total_spending,
            'visits' => (int) $this->visits,
            'bookingsCount' => (int) ($this->bookings_count ?? 0),
            'joinedAt' => $this->created_at?->toIso8601String(),

            // PDPA. Shown so staff can see the answer before marketing to
            // someone, not so they can change it — consent someone else ticked
            // for you is not consent, and there is no endpoint for that.
            'marketingConsent' => $this->marketing_consent,
            'consentAt' => $this->consent_at?->toIso8601String(),
            'unsubscribedAt' => $this->unsubscribed_at?->toIso8601String(),

            'membership' => $this->relationLoaded('membership') && $this->membership ? [
                'tier' => $this->membership->tier,
                'points' => (int) $this->membership->points,
            ] : null,

            'walletBalance' => $this->relationLoaded('wallet') && $this->wallet
                ? (float) $this->wallet->balance
                : 0.0,

            'recentBookings' => $this->relationLoaded('bookings')
                ? $bookings->map(fn ($b) => [
                    'id' => (string) $b->id,
                    'code' => $b->code,
                    'courtName' => $b->court?->name,
                    'date' => $b->date,
                    'start' => $b->start,
                    'end' => $b->end,
                    'amount' => (float) $b->amount,
                    'status' => $b->status,
                ])->values()
                : [],
        ];
    }
}
