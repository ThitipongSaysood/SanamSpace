<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Court;

/**
 * Builds a court's daily schedule (hourly slots) and marks each hour booked
 * by reading the REAL bookings for that court+date from the database. A slot
 * counts as booked when any non-cancelled booking overlaps it.
 */
class CourtScheduleService
{
    private const START_HOUR = 10;
    private const END_HOUR = 22;

    /**
     * @return array{courtId: string, date: string, slots: array<int, array{start: string, end: string, status: string}>}
     */
    public function generate(Court $court, string $date): array
    {
        $bookedHours = $this->bookedHours($court, $date);

        $slots = [];
        for ($hour = self::START_HOUR; $hour < self::END_HOUR; $hour++) {
            $slots[] = [
                'start' => sprintf('%02d:00', $hour),
                'end' => sprintf('%02d:00', $hour + 1),
                'status' => isset($bookedHours[$hour]) ? 'booked' : 'available',
            ];
        }

        return [
            'courtId' => $court->id,
            'date' => $date,
            'slots' => $slots,
        ];
    }

    /**
     * Hours (start-of-slot) occupied by an active booking on this court+date.
     *
     * @return array<int, true>
     */
    private function bookedHours(Court $court, string $date): array
    {
        $bookings = Booking::query()
            ->where('court_id', $court->id)
            ->whereDate('date', $date)
            ->where('status', '!=', 'cancelled')
            ->get(['start', 'end']);

        $hours = [];
        foreach ($bookings as $booking) {
            $startHour = (int) substr($booking->start, 0, 2);
            $endHour = (int) substr($booking->end, 0, 2);
            for ($h = $startHour; $h < $endHour; $h++) {
                $hours[$h] = true;
            }
        }

        return $hours;
    }
}
