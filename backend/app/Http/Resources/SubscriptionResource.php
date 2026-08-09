<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Platform subscription view for the Super Admin API:
 * { id, organizationName, planName, price, status, startedAt, endsAt }
 *
 * Expects `organization` and `plan` relations to be eager-loaded.
 */
class SubscriptionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            // The org, not just its name: the admin bills a venue from this list.
            'organizationId' => $this->organization_id,
            'organizationName' => $this->organization?->name,
            'planName' => $this->plan?->name,
            'planCode' => $this->plan?->code,
            // What this plan includes. Sent so the owner portal can hide what
            // it cannot use — a menu that always 402s is worse than no menu.
            'features' => \App\Support\PlanFeatures::for($this->organization_id),
            'price' => $this->plan ? (float) $this->plan->price : null,
            'status' => $this->status,
            'startedAt' => $this->started_at?->toIso8601String(),
            'endsAt' => $this->ends_at?->toIso8601String(),
            // Whole days until the plan ends (signed: negative = already expired,
            // null = no end date / unlimited).
            'daysRemaining' => $this->ends_at
                ? (int) now()->startOfDay()->diffInDays($this->ends_at->copy()->startOfDay(), false)
                : null,
        ];
    }
}
