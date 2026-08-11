<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/**
 * When a booking actually is — date and slot, on the venue's wall clock.
 *
 * A small object rather than three loose arguments because it travels together
 * and is meaningless apart: a start time with no date cannot answer "is this a
 * Tuesday", and a date with no times cannot answer "is this before 16:00".
 * Passing them separately is how one of the three gets dropped at a call site.
 *
 * `date`, `start` and `end` are the same strings a booking row holds
 * ("2026-08-11", "07:00", "08:00"), so every comparison is against the venue's
 * own clock rather than the server's.
 */
final class BookingWindow
{
    public readonly string $date;

    public readonly string $start;

    public readonly string $end;

    /**
     * Normalised here rather than at the call sites, because "07:00:00" and
     * "07:00" are the same time to everyone except a string comparison — and a
     * comparison is exactly what decides whether a discount applies.
     */
    public function __construct(string $date, string $start, string $end)
    {
        $this->date = self::clip($date, 10);
        $this->start = self::clip($start);
        $this->end = self::clip($end);
    }

    /** Null in, null out — so a caller with nothing to say says nothing. */
    public static function tryFrom(?string $date, ?string $start, ?string $end): ?self
    {
        if (blank($date) || blank($start) || blank($end)) {
            return null;
        }

        return new self($date, $start, $end);
    }

    /** 1 = Monday … 7 = Sunday, matching `coupons.valid_days`. */
    public function isoWeekday(): int
    {
        return CarbonImmutable::parse($this->date)->isoWeekday();
    }

    private static function clip(string $value, int $length = 5): string
    {
        return substr(trim($value), 0, $length);
    }
}
