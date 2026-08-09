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
            'expiresAt' => $this->expires_at,
            'benefits' => $this->benefits ?? [],
        ];
    }
}
