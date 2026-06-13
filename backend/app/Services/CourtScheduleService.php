<?php

namespace App\Services;

use App\Models\Court;

/**
 * Generates a court's daily schedule dynamically, mirroring the customer
 * frontend mock: hourly slots 10:00–22:00, with 12:00 and 19:00 marked
 * booked deterministically. No table is needed for this slice.
 */
class CourtScheduleService
{
    private const START_HOUR = 10;
    private const END_HOUR = 22;

    /** Hours (start-of-slot) that are deterministically booked. */
    private const BOOKED_HOURS = [12, 19];

    /**
     * @return array{courtId: string, date: string, slots: array<int, array{start: string, end: string, status: string}>}
     */
    public function generate(Court $court, string $date): array
    {
        $slots = [];

        for ($hour = self::START_HOUR; $hour < self::END_HOUR; $hour++) {
            $start = sprintf('%02d:00', $hour);
            $end = sprintf('%02d:00', $hour + 1);

            $slots[] = [
                'start' => $start,
                'end' => $end,
                'status' => in_array($hour, self::BOOKED_HOURS, true) ? 'booked' : 'available',
            ];
        }

        return [
            'courtId' => $court->id,
            'date' => $date,
            'slots' => $slots,
        ];
    }
}
