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

        return [
            'id' => $this->slug,
            'name' => $this->name,
            'status' => $this->status,
            'planName' => $subscription?->plan?->name,
            'subscriptionStatus' => $subscription?->status,
            'branchCount' => (int) ($this->branches_count ?? 0),
            'courtCount' => (int) ($this->courts_count ?? 0),
            'customerCount' => (int) ($this->customers_count ?? 0),
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
