<?php

namespace App\Support;

/**
 * One phone number, one shape.
 *
 * Staff type "081-234-5678", the app stores "0812345678", LINE hands back
 * "+66812345678" — three spellings of one person. Comparing them raw is why the
 * same customer can end up as three rows, each holding part of their points.
 *
 * Deliberately forgiving about what it accepts and strict about what it
 * returns: anything too short to be a real Thai number comes back null rather
 * than as a key that would match strangers to each other.
 */
class ThaiPhone
{
    public static function normalize(?string $phone): ?string
    {
        if ($phone === null) {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $phone) ?? '';

        // +66 81 234 5678 and 66 81 234 5678 are the same 081 234 5678. Only
        // strip it when what remains looks like a local number, so a 66-prefixed
        // string that is really something else is left alone.
        if (str_starts_with($digits, '66') && strlen($digits) >= 11) {
            $digits = '0'.substr($digits, 2);
        }

        // Shorter than a landline: not enough to identify anyone, and matching
        // on it would merge people who share nothing but a typo.
        return strlen($digits) >= 9 ? $digits : null;
    }
}
