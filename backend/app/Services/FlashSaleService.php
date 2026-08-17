<?php

namespace App\Services;

use App\Models\Court;
use App\Models\FlashSale;
use App\Support\BookingWindow;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * What a flash sale takes off, and which hours it takes it off.
 *
 * A flash sale discounts court time by the HOUR: a 15:00–17:00 booking against
 * a 13:00–16:00 sale is discounted for its 15:00 hour and full-price for the
 * 16:00 one, because that is what the badge on the slot promised. The booking
 * gets the single best applicable sale — never two stacked — and the amount is
 * snapshotted onto the booking so a sale ended tomorrow never re-prices today.
 */
class FlashSaleService
{
    /** Active sales for a venue on a date (campaign range + weekday), scopes loaded. */
    public function activeForDate(string $orgId, string $date): Collection
    {
        $iso = CarbonImmutable::parse($date)->isoWeekday();

        return FlashSale::query()
            ->forOrganization($orgId)
            ->where('is_active', true)
            ->where(fn ($q) => $q->whereNull('starts_at')->orWhereDate('starts_at', '<=', $date))
            ->where(fn ($q) => $q->whereNull('ends_at')->orWhereDate('ends_at', '>=', $date))
            ->with('scopes')
            ->get()
            ->filter(fn (FlashSale $s) => $this->runsOnWeekday($s, $iso))
            ->values();
    }

    /**
     * The best flash discount for a whole booking, and which sale gave it.
     *
     * @return array{amount: float, label: ?string, flashSale: ?FlashSale}
     */
    public function forBooking(string $orgId, Court $court, BookingWindow $window): array
    {
        $none = ['amount' => 0.0, 'label' => null, 'flashSale' => null];

        $sales = $this->activeForDate($orgId, $window->date)
            ->filter(fn (FlashSale $s) => $s->coversCourt($court));

        if ($sales->isEmpty()) {
            return $none;
        }

        $hourPrice = (float) $court->price_per_hour;
        $courtAmount = round($hourPrice * $this->hoursBetween($window->start, $window->end), 2);
        $hours = $this->hourSlots($window->start, $window->end);

        $best = $none;
        foreach ($sales as $sale) {
            $covered = array_filter($hours, fn ($h) => $this->coversHour($sale, $h[0], $h[1]));
            if (empty($covered)) {
                continue;
            }

            $raw = $sale->discount_type === 'fixed'
                ? (float) $sale->discount_value * count($covered)          // ฿X off each covered hour
                : $hourPrice * ((float) $sale->discount_value / 100) * count($covered);

            if ($sale->max_discount !== null) {
                $raw = min($raw, (float) $sale->max_discount);
            }

            $amount = round(min($raw, $courtAmount), 2);
            if ($amount > $best['amount']) {
                $best = ['amount' => $amount, 'label' => '⚡ '.$sale->name, 'flashSale' => $sale];
            }
        }

        return $best;
    }

    /**
     * For the schedule grid: the best sale covering this single hour on this
     * court, or null. Ranked by percent-equivalent so the biggest cut shows.
     */
    public function saleForHour(Collection $sales, Court $court, string $hourStart, string $hourEnd): ?FlashSale
    {
        $best = null;
        $bestPct = 0.0;

        foreach ($sales as $sale) {
            if (! $sale->coversCourt($court) || ! $this->coversHour($sale, $hourStart, $hourEnd)) {
                continue;
            }

            $price = (float) $court->price_per_hour;
            $pct = $sale->discount_type === 'fixed' && $price > 0
                ? (float) $sale->discount_value / $price * 100
                : (float) $sale->discount_value;

            if ($pct > $bestPct) {
                $bestPct = $pct;
                $best = $sale;
            }
        }

        return $best;
    }

    /** What a single hour at $hourPrice costs after this sale — never below 0. */
    public function hourPriceUnder(FlashSale $sale, float $hourPrice): float
    {
        $off = $sale->discount_type === 'fixed'
            ? (float) $sale->discount_value
            : $hourPrice * ((float) $sale->discount_value / 100);

        if ($sale->max_discount !== null) {
            $off = min($off, (float) $sale->max_discount);
        }

        return round(max(0.0, $hourPrice - $off), 2);
    }

    private function runsOnWeekday(FlashSale $sale, int $iso): bool
    {
        $days = $sale->valid_days;

        return blank($days) || in_array($iso, array_map('intval', $days), true);
    }

    /** Whole hour [start,end) sits inside the sale's daily window. */
    private function coversHour(FlashSale $sale, string $hourStart, string $hourEnd): bool
    {
        $from = $sale->valid_from_time;
        $to = $sale->valid_to_time;

        return (blank($from) || $hourStart >= $from) && (blank($to) || $hourEnd <= $to);
    }

    /** The full-hour slots inside a booking window; a trailing partial hour is ignored. */
    private function hourSlots(string $start, string $end): array
    {
        $slots = [];
        for ($m = $this->toMin($start); $m + 60 <= $this->toMin($end); $m += 60) {
            $slots[] = [$this->fromMin($m), $this->fromMin($m + 60)];
        }

        return $slots;
    }

    private function hoursBetween(string $start, string $end): float
    {
        return ($this->toMin($end) - $this->toMin($start)) / 60;
    }

    private function toMin(string $hhmm): int
    {
        [$h, $m] = array_map('intval', explode(':', $hhmm));

        return $h * 60 + $m;
    }

    private function fromMin(int $min): string
    {
        return sprintf('%02d:%02d', intdiv($min, 60), $min % 60);
    }
}
