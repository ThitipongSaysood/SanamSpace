<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Platform detail view of an Organization for the Super Admin API:
 * org core + settings summary + active plan + counts.
 *
 * Expects `settings` and `activeSubscription.plan` eager-loaded and the
 * branches_count / courts_count / customers_count withCount aggregates.
 */
class AdminOrganizationDetailResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $subscription = $this->activeSubscription;
        $settings = $this->settings;

        // Owner = membership with role 'owner', else the first membership.
        $memberships = $this->relationLoaded('organizationUsers') ? $this->organizationUsers : collect();
        $ownerMembership = $memberships->firstWhere(fn ($m) => $m->role?->code === 'owner') ?? $memberships->first();
        $ownerUser = $ownerMembership?->user;

        $endsAt = $subscription?->ends_at;

        return [
            'id' => $this->slug,
            'name' => $this->name,
            'businessType' => $this->business_type,
            'status' => $this->status,
            'timezone' => $this->timezone,
            'createdAt' => $this->created_at?->toIso8601String(),
            'owner' => $ownerUser ? [
                'name' => $ownerUser->display_name ?? $ownerUser->name,
                'email' => $ownerUser->email,
            ] : null,
            'settings' => $settings ? [
                'primaryColor' => $settings->primary_color,
                'phone' => $settings->phone,
                'email' => $settings->email,
                'address' => $settings->address,
                'lineOaUrl' => $settings->line_oa_url,
                'timezone' => $settings->timezone,
            ] : null,
            'plan' => $subscription?->plan
                ? new PlanResource($subscription->plan->loadMissing('enabledFeatures'))
                : null,
            'subscription' => $subscription ? [
                'planName' => $subscription->plan?->name,
                'status' => $subscription->status,
                'interval' => $subscription->plan?->interval,
                'price' => $subscription->plan ? (float) $subscription->plan->price : null,
                'startedAt' => $subscription->started_at?->toIso8601String(),
                'endsAt' => $endsAt?->toIso8601String(),
                'daysRemaining' => $endsAt
                    ? (int) now()->startOfDay()->diffInDays($endsAt->copy()->startOfDay(), false)
                    : null,
            ] : null,
            'subscriptionStatus' => $subscription?->status,
            'counts' => [
                'branches' => (int) ($this->branches_count ?? 0),
                'courts' => (int) ($this->courts_count ?? 0),
                'customers' => (int) ($this->customers_count ?? 0),
            ],
        ];
    }
}
