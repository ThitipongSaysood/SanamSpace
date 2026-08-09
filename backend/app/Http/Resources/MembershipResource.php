<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Maps a Membership to the frontend `Membership` shape (lib/types.ts):
 * { tier, memberId, points, expiresAt, benefits[] }
 */
class MembershipResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'tier' => $this->tier,
            'memberId' => $this->member_id,
            'points' => (int) $this->points,
            // What the tier is actually judged on, and how far the next one is.
            // Without this the card shows a tier with no way to understand it.
            'lifetimePoints' => (int) ($this->lifetime_points ?? 0),
            'nextTier' => app(\App\Services\PointsService::class)->progress($this->resource)['nextTier'],
            'pointsToNextTier' => app(\App\Services\PointsService::class)->progress($this->resource)['pointsToNextTier'],
            // Formatted here, stored as a date. The column used to BE the Thai
            // string, which meant nothing could compare or query it — and the
            // seeded rows sat two years expired without anything noticing.
            'expiresAt' => $this->expires_on ? \App\Support\ThaiDate::short($this->expires_on) : null,
            'expiresOn' => $this->expires_on?->toDateString(),
            'benefits' => $this->benefits ?? [],
        ];
    }
}
