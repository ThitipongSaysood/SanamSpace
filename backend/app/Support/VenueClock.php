<?php

namespace App\Support;

use App\Models\OrganizationSetting;
use Illuminate\Support\Carbon;

/**
 * What time it is *at the venue*.
 *
 * The app runs in UTC; bookings store the venue's wall clock (`date`, `start`,
 * `end` as plain strings). Comparing one to the other is off by the venue's
 * offset — seven hours for a Thai venue — and that is not a rounding error:
 *
 *  - "วันนี้" computed from the UTC date reports YESTERDAY between midnight and
 *    07:00 venue time, every single day;
 *  - a "starting in the next 2 hours" window at 13:26 in Bangkok was looking at
 *    06:26–08:26, so it counted the morning's bookings and missed the
 *    afternoon's.
 *
 * One place to ask, so the next feature that needs the venue's clock does not
 * quietly invent a third answer.
 */
class VenueClock
{
    public static function timezone(?string $organizationId): string
    {
        if (! $organizationId) {
            return 'Asia/Bangkok';
        }

        return OrganizationSetting::query()
            ->where('organization_id', $organizationId)
            ->value('timezone') ?: 'Asia/Bangkok';
    }

    /** Now, on the venue's wall clock. */
    public static function now(?string $organizationId): Carbon
    {
        return Carbon::now(self::timezone($organizationId));
    }
}
