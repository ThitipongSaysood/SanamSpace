<?php

namespace App\Support;

use DateTimeInterface;

/**
 * Thai display dates, in one place.
 *
 * Several files each carried their own month array, and one of them wrote the
 * formatted string straight into a database column — which is how
 * `memberships.expires_at` ended up being text nothing could compare or query.
 *
 * Format for display; store dates as dates.
 */
final class ThaiDate
{
    private const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

    /** "8 ส.ค. 2570" — Buddhist era, as Thai readers expect. */
    public static function short(DateTimeInterface $date): string
    {
        return sprintf(
            '%d %s %d',
            (int) $date->format('j'),
            self::MONTHS[(int) $date->format('n') - 1],
            (int) $date->format('Y') + 543,
        );
    }
}
