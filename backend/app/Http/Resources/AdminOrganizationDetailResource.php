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
                // LINE per-venue override. Secrets are write-only: expose only *Set flags.
                'lineChannelId' => $settings->line_channel_id,
                'lineLiffId' => $settings->line_liff_id,
                'lineChannelSecretSet' => filled($settings->line_channel_secret),
                'lineMessagingTokenSet' => filled($settings->line_messaging_token),
            ] : null,
            'plan' => $subscription?->plan
                ? new PlanResource($subscription->plan->loadMissing('enabledFeatures'))
                : null,
            'subscription' => $subscription ? [
                // The drawer renews and re-plans by subscription id as well as
                // by organisation, so it needs the id it is acting on.
                'id' => (string) $subscription->id,
                'planId' => $subscription->plan?->id,
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
            // A trial looks like any other active subscription from the
            // outside — same plan, same expiry, same lockout. This is the only
            // thing that says the venue has not paid anything yet.
            'trial' => [
                'onTrial' => $this->resource->onTrial(),
                'startedAt' => $this->trial_start_at?->toIso8601String(),
                'endsAt' => $this->trial_end_at?->toIso8601String(),
            ],
            'counts' => [
                'branches' => (int) ($this->branches_count ?? 0),
                'courts' => (int) ($this->courts_count ?? 0),
                'customers' => (int) ($this->customers_count ?? 0),
            ],
            // What this venue rents, per branch.
            //
            // Per branch and not per venue because that is where it is stored,
            // and branches of one venue genuinely differ — flattening them to a
            // single list would make saving one branch silently rewrite the
            // others. These two values drive the customer app's loading screen
            // and its notification icon, so a platform admin setting a venue up
            // needs to be able to reach them.
            'branches' => $this->whenLoaded('branches', fn () => $this->branches->map(fn ($b) => [
                'id' => (string) $b->id,
                'name' => $b->name,
                'sports' => array_values((array) ($b->sports ?? [])),
            ])->values()->all(), []),
        ];
    }
}
