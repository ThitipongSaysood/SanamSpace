<?php

namespace App\Support;

use App\Models\Subscription;
use Illuminate\Support\Facades\DB;

/**
 * What this venue's plan actually includes.
 *
 * The catalogue existed, was editable, was displayed on the pricing page — and
 * was read by nothing. Every venue had every feature regardless of what it paid
 * for, which made the plan table a decoration rather than a product.
 *
 * Two rules worth stating, because both are easy to get wrong in the direction
 * that hurts a paying customer:
 *
 *  - **Anything not in the catalogue is included.** Booking, check-in, slip
 *    review, customers, refunds — the things a venue cannot operate without —
 *    are not entries here, and so are never gated. A new page does not become
 *    unavailable to everyone the day someone forgets to add a row.
 *  - **A venue with no subscription row keeps the core.** Locking a venue out
 *    of its own bookings because a billing record is missing is a support call,
 *    not enforcement. Expiry is handled separately, by EnsureSubscriptionActive.
 */
class PlanFeatures
{
    /** @var array<string, list<string>> resolved per request, per organization */
    private static array $cache = [];

    /** @return list<string> feature codes this organization's plan enables */
    public static function for(?string $organizationId): array
    {
        if (! $organizationId) {
            return [];
        }

        if (isset(self::$cache[$organizationId])) {
            return self::$cache[$organizationId];
        }

        $planId = Subscription::query()
            ->forOrganization($organizationId)
            ->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->orderByDesc('created_at')
            ->value('plan_id');

        $codes = $planId
            ? DB::table('plan_features')
                ->join('features', 'features.id', '=', 'plan_features.feature_id')
                ->where('plan_features.plan_id', $planId)
                ->where('plan_features.enabled', 1)
                ->whereNull('features.deleted_at')
                ->pluck('features.code')
                ->all()
            : [];

        return self::$cache[$organizationId] = array_values($codes);
    }

    public static function allows(?string $organizationId, string $code): bool
    {
        return in_array($code, self::for($organizationId), true);
    }

    /**
     * Every code that is gated at all.
     *
     * Used to tell "this plan does not include it" apart from "this is not a
     * paid feature" — the difference between showing an upgrade prompt and
     * showing nothing.
     */
    public static function gatedCodes(): array
    {
        return DB::table('features')->whereNull('deleted_at')->pluck('code')->all();
    }

    /** Tests and long-running processes must not see another org's answer. */
    public static function flush(): void
    {
        self::$cache = [];
    }
}
