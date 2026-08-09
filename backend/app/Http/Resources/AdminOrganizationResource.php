<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Platform list view of an Organization for the Super Admin API:
 * { id(slug), name, status, planName, subscriptionStatus,
 *   branchCount, courtCount, customerCount, createdAt }
 *
 * Counts come from withCount aggregates (branches_count, courts_count,
 * customers_count). The plan/subscription come from the eager-loaded
 * `activeSubscription.plan` relation.
 */
class AdminOrganizationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $subscription = $this->activeSubscription;
        $settings = $this->settings;
        $endsAt = $subscription?->ends_at;

        $memberships = $this->relationLoaded('organizationUsers') ? $this->organizationUsers : collect();
        $owner = ($memberships->firstWhere(fn ($m) => $m->role?->code === 'owner') ?? $memberships->first())?->user;

        return [
            'id' => $this->slug,
            'name' => $this->name,
            'email' => $settings?->email,
            'ownerName' => $owner?->display_name ?? $owner?->name,
            'ownerPhone' => $settings?->phone,
            'status' => $this->status,
            'planName' => $subscription?->plan?->name,
            'subscriptionStatus' => $subscription?->status,
            // A trial is an ordinary active subscription with an end date, so
            // the list would otherwise show a venue that has paid nothing
            // exactly like one that pays every month.
            'onTrial' => $this->resource->onTrial(),
            'branchCount' => (int) ($this->branches_count ?? 0),
            'courtCount' => (int) ($this->courts_count ?? 0),
            'customerCount' => (int) ($this->customers_count ?? 0),
            'userCount' => (int) ($this->customers_count ?? 0),
            'revenue' => (float) ($this->revenue ?? 0),
            'expiresAt' => $endsAt?->toIso8601String(),
            'daysRemaining' => $endsAt
                ? (int) now()->startOfDay()->diffInDays($endsAt->copy()->startOfDay(), false)
                : null,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
