<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Court;
use App\Models\CourtBlock;

/**
 * Builds a court's daily schedule (hourly slots) and marks each hour booked
 * by reading the REAL bookings for that court+date from the database. A slot
 * counts as booked when any non-cancelled booking overlaps it.
 */
class CourtScheduleService
{
    private const START_HOUR = 10;
    private const END_HOUR = 22;

    public function __construct(private FlashSaleService $flash) {}

    /**
     * @return array{courtId: string, date: string, slots: array<int, array{start: string, end: string, status: string, onSale: bool, salePrice: ?float}>}
     */
    public function generate(Court $court, string $date): array
    {
        $bookedHours = $this->bookedHours($court, $date);
        // The sales that could touch this court+date, resolved once.
        $sales = $this->flash->activeForDate($court->organization_id, $date);
        $hourPrice = (float) $court->price_per_hour;

        $slots = [];
        for ($hour = self::START_HOUR; $hour < self::END_HOUR; $hour++) {
            $start = sprintf('%02d:00', $hour);
            $end = sprintf('%02d:00', $hour + 1);
            $sale = $this->flash->saleForHour($sales, $court, $start, $end);

            $slots[] = [
                'start' => $start,
                'end' => $end,
                'status' => isset($bookedHours[$hour]) ? 'booked' : 'available',
                // What the customer sees on the grid: this hour is on sale, and
                // what it costs after the cut.
                'onSale' => $sale !== null,
                'salePrice' => $sale ? $this->flash->hourPriceUnder($sale, $hourPrice) : null,
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

        // Maintenance / closures also make slots unavailable.
        $blocks = CourtBlock::query()
            ->where('court_id', $court->id)
            ->whereDate('date', $date)
            ->get();
        foreach ($blocks as $block) {
            $from = $block->start ? (int) substr($block->start, 0, 2) : self::START_HOUR;
            $to = $block->end ? (int) substr($block->end, 0, 2) : self::END_HOUR;
            for ($h = $from; $h < $to; $h++) {
                $hours[$h] = true;
            }
        }

        return $hours;
    }
}
