<?php

namespace App\Support;

use App\Models\Booking;
use App\Models\Branch;
use App\Models\Court;
use App\Models\OrganizationUser;
use App\Models\Plan;
use App\Models\Subscription;
use Illuminate\Support\Facades\Storage;

/**
 * How many of a thing a venue's plan allows, and how many it already has.
 *
 * The numbers on the pricing page — 1 สาขา, 4 คอร์ท, 3 พนักงาน — were stored on
 * the plan, editable in the admin screens, and read by nothing. A Starter venue
 * at ฿990 could open fifty courts across twenty branches. The feature gating
 * added earlier decides WHICH pages a venue sees; this decides HOW MUCH.
 *
 * **Structural limits are hard; volume is not.**
 *
 * Branches, courts and staff are things an owner deliberately adds, one click
 * at a time, while looking at the screen that says why it stopped. Refusing
 * those is fair.
 *
 * Monthly bookings are not, and are deliberately NOT blocked here. A booking
 * arrives from a customer who has no idea a plan exists; turning them away
 * would take the venue's revenue to enforce the platform's billing, and this
 * system has already decided the other way once — an expired venue is locked
 * out of its own portal while its customers keep booking. The count is
 * reported so the venue and the platform can both see it and have the
 * conversation; it is not a gate.
 *
 * `storage_gb` is now honest and enforced — but only on OWNER uploads (venue
 * images/banners via /owner/uploads), a deliberate one-click action like adding
 * a court. Uploads now live under a per-venue path (`slips/{orgId}`,
 * `venues/{orgId}`), so used bytes is a real sum, not an invented number.
 * Customer slip uploads and the owner's own billing-slip are NOT gated: refusing
 * a customer's payment slip, or the owner's attempt to pay their bill, to
 * enforce storage billing is the same mistake the booking limit avoids.
 */
class PlanLimits
{
    /** The limits that are enforced, mapped to the plan column that holds them. */
    public const ENFORCED = [
        'branch' => 'branch_limit',
        'court' => 'court_limit',
        'staff' => 'staff_limit',
    ];

    /** Counted and shown, never blocked — see the class note. */
    public const REPORTED = [
        'booking' => 'monthly_booking_limit',
    ];

    private const LABELS = [
        'branch' => 'สาขา',
        'court' => 'คอร์ท',
        'staff' => 'พนักงาน',
        'booking' => 'การจองต่อเดือน',
    ];

    /** @return int|null the ceiling, or null for unlimited */
    public static function limitFor(?string $organizationId, string $resource): ?int
    {
        $column = self::ENFORCED[$resource] ?? self::REPORTED[$resource] ?? null;
        $plan = $column ? self::planFor($organizationId) : null;

        if (! $plan) {
            // No plan on file means no ceiling. Locking a venue out of adding a
            // court because a billing row is missing is a support call, not
            // enforcement — expiry is EnsureSubscriptionActive's job.
            return null;
        }

        $limit = $plan->{$column};

        return $limit === null ? null : max(0, (int) $limit);
    }

    public static function usageFor(string $organizationId, string $resource): int
    {
        return match ($resource) {
            'branch' => Branch::query()->forOrganization($organizationId)->count(),
            'court' => Court::query()->forOrganization($organizationId)->count(),
            'staff' => OrganizationUser::query()->forOrganization($organizationId)->count(),
            // The calendar month the venue is in right now, by created_at: this
            // is "how many bookings did we take", not "how many are for dates
            // this month".
            'booking' => Booking::query()->forOrganization($organizationId)
                ->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])
                ->count(),
            default => 0,
        };
    }

    /** Whether adding one more would go past the ceiling. */
    public static function isFull(?string $organizationId, string $resource): bool
    {
        $limit = self::limitFor($organizationId, $resource);

        return $organizationId !== null
            && $limit !== null
            && self::usageFor($organizationId, $resource) >= $limit;
    }

    public static function label(string $resource): string
    {
        return self::LABELS[$resource] ?? $resource;
    }

    private const BYTES_PER_GB = 1073741824; // 1024^3

    /** The venue's storage ceiling in bytes, or null for unlimited / no plan. */
    public static function storageLimitBytes(?string $organizationId): ?int
    {
        $plan = $organizationId ? self::planFor($organizationId) : null;
        $gb = $plan?->storage_gb;

        return $gb === null ? null : max(0, (int) $gb) * self::BYTES_PER_GB;
    }

    /**
     * Real bytes a venue occupies — the sum of everything under its per-venue
     * upload folders. Honest because uploads now carry the org id in the path.
     */
    public static function storageUsedBytes(string $organizationId): int
    {
        $disk = Storage::disk('public');
        $total = 0;

        foreach (["slips/{$organizationId}", "venues/{$organizationId}"] as $dir) {
            foreach ($disk->files($dir, true) as $file) {
                $total += $disk->size($file);
            }
        }

        return $total;
    }

    /** Whether accepting `$incomingBytes` more would push the venue past its ceiling. */
    public static function storageWouldExceed(?string $organizationId, int $incomingBytes): bool
    {
        if (! $organizationId) {
            return false;
        }

        $limit = self::storageLimitBytes($organizationId);

        return $limit !== null && (self::storageUsedBytes($organizationId) + $incomingBytes) > $limit;
    }

    /**
     * Every limit with what is used against it, for the portals to show.
     *
     * A venue should meet its ceiling on a usage bar long before it meets it as
     * a refusal.
     *
     * @return array<string, array{used: int, limit: ?int, label: string, enforced: bool}>
     */
    public static function summary(?string $organizationId): array
    {
        if (! $organizationId) {
            return [];
        }

        $out = [];

        foreach ([...array_keys(self::ENFORCED), ...array_keys(self::REPORTED)] as $resource) {
            $out[$resource] = [
                'used' => self::usageFor($organizationId, $resource),
                'limit' => self::limitFor($organizationId, $resource),
                'label' => self::label($resource),
                'enforced' => isset(self::ENFORCED[$resource]),
            ];
        }

        return $out;
    }

    /**
     * Deliberately not memoised, unlike PlanFeatures.
     *
     * A cache here would have to be flushed everywhere a plan can change —
     * upgrade, downgrade, trial, renewal, the admin grid — and the one call
     * site that got missed would be the one that let a venue past its ceiling.
     * These are create routes and a settings screen: one extra query is not
     * worth that class of bug.
     */
    private static function planFor(?string $organizationId): ?Plan
    {
        if (! $organizationId) {
            return null;
        }

        $planId = Subscription::query()
            ->forOrganization($organizationId)
            ->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->orderByDesc('created_at')
            ->value('plan_id');

        return $planId ? Plan::find($planId) : null;
    }
}
