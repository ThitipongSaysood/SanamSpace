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

        return [
            'id' => $this->slug,
            'name' => $this->name,
            'businessType' => $this->business_type,
            'status' => $this->status,
            'timezone' => $this->timezone,
            'createdAt' => $this->created_at?->toIso8601String(),
            'settings' => $settings ? [
                'primaryColor' => $settings->primary_color,
                'phone' => $settings->phone,
                'email' => $settings->email,
                'address' => $settings->address,
                'timezone' => $settings->timezone,
            ] : null,
            'plan' => $subscription?->plan
                ? new PlanResource($subscription->plan->loadMissing('enabledFeatures'))
                : null,
            'subscriptionStatus' => $subscription?->status,
            'counts' => [
                'branches' => (int) ($this->branches_count ?? 0),
                'courts' => (int) ($this->courts_count ?? 0),
                'customers' => (int) ($this->customers_count ?? 0),
            ],
        ];
    }
}
