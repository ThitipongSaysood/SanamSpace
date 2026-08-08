<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BookingRental;
use App\Models\RentalItem;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Renting equipment against a booking's time window.
 *
 * The whole problem is availability. Stock says how many rackets the venue
 * owns; what matters is how many are already out **during the hours being
 * booked**. Four rackets can be rented all day, just not to two overlapping
 * bookings at once — so this counts overlaps, exactly the way the court
 * double-booking check does, rather than keeping a running "remaining" number
 * that would be wrong the moment a booking ends.
 */
class RentalService
{
    /**
     * How many of each item are free for `$date` between `$start` and `$end`.
     *
     * @return array<string, int> keyed by rental item id
     */
    public function availability(
        string $orgId,
        string $date,
        string $start,
        string $end,
        ?string $ignoreBookingId = null,
    ): array {
        $items = RentalItem::query()->forOrganization($orgId)->rentable()->get();

        if ($items->isEmpty()) {
            return [];
        }

        // Overlap iff existing.start < new.end AND existing.end > new.start —
        // the same rule the court check uses, so the two cannot disagree.
        $taken = BookingRental::query()
            ->whereIn('rental_item_id', $items->pluck('id'))
            ->whereHas('booking', function ($q) use ($orgId, $date, $start, $end, $ignoreBookingId) {
                $q->where('organization_id', $orgId)
                    ->where('date', $date)
                    ->where('status', '!=', 'cancelled')
                    ->where('start', '<', $end)
                    ->where('end', '>', $start);

                // Editing an existing booking must not count itself as a rival.
                if ($ignoreBookingId) {
                    $q->where('id', '!=', $ignoreBookingId);
                }
            })
            ->selectRaw('rental_item_id, SUM(quantity) as out_qty')
            ->groupBy('rental_item_id')
            ->pluck('out_qty', 'rental_item_id');

        $free = [];
        foreach ($items as $item) {
            $free[$item->id] = max(0, $item->stock_qty - (int) ($taken[$item->id] ?? 0));
        }

        return $free;
    }

    /**
     * Price and validate the requested lines against what is actually free.
     *
     * Returns the rows to insert plus their total. Nothing is written here — the
     * caller does that inside the booking's own transaction, so a booking and
     * its rentals are created together or not at all.
     *
     * @param  array<int, array{itemId: string, quantity: int}>  $lines
     * @return array{rows: array<int, array<string, mixed>>, total: float}
     *
     * @throws ValidationException
     */
    public function quote(
        string $orgId,
        array $lines,
        string $date,
        string $start,
        string $end,
        float $hours,
        ?string $ignoreBookingId = null,
    ): array {
        if ($lines === []) {
            return ['rows' => [], 'total' => 0.0];
        }

        // Two taps on the same racket is one line of two; checking them
        // separately would let each pass a check the pair fails.
        $wanted = [];
        foreach ($lines as $line) {
            $id = $line['itemId'];
            $wanted[$id] = ($wanted[$id] ?? 0) + (int) $line['quantity'];
        }

        $items = RentalItem::query()
            ->forOrganization($orgId)
            ->whereIn('id', array_keys($wanted))
            ->get()
            ->keyBy('id');

        $free = $this->availability($orgId, $date, $start, $end, $ignoreBookingId);

        $rows = [];
        $total = 0.0;

        foreach ($wanted as $itemId => $quantity) {
            $item = $items->get($itemId);

            if (! $item || ! $item->is_active) {
                throw ValidationException::withMessages([
                    'rentals' => 'มีอุปกรณ์ที่ไม่พบหรือปิดให้เช่าอยู่ในรายการ',
                ]);
            }

            if ($quantity < 1) {
                throw ValidationException::withMessages([
                    'rentals' => "จำนวนของ {$item->name} ต้องมากกว่า 0",
                ]);
            }

            $available = $free[$itemId] ?? 0;

            if ($quantity > $available) {
                // Named and numbered: the customer is choosing right now and
                // needs to know what they can actually have.
                throw ValidationException::withMessages([
                    'rentals' => "{$item->name} ช่วงเวลานี้ว่าง {$available} ชิ้น เช่า {$quantity} ไม่ได้",
                ]);
            }

            $lineTotal = round($item->priceFor($hours) * $quantity, 2);
            $total += $lineTotal;

            $rows[] = [
                'rental_item_id' => $item->id,
                // Snapshots: a later reprice must not change what was quoted.
                'name' => $item->name,
                'unit_price' => $item->price,
                'price_unit' => $item->price_unit,
                'quantity' => $quantity,
                'hours' => $hours,
                'line_total' => $lineTotal,
            ];
        }

        return ['rows' => $rows, 'total' => round($total, 2)];
    }

    /** Attach priced lines to a booking and update its totals. */
    public function attach(Booking $booking, array $rows, float $rentalTotal): void
    {
        foreach ($rows as $row) {
            BookingRental::create($row + ['booking_id' => $booking->id]);
        }

        $booking->update([
            'rental_total' => $rentalTotal,
            // `amount` stays the grand total, so every existing payment, refund
            // and revenue path keeps working without knowing rentals exist.
            'amount' => round((float) $booking->court_amount + $rentalTotal, 2),
        ]);
    }

    /** The items a customer can pick from, with what is free for their slot. */
    public function offer(string $orgId, string $date, string $start, string $end, float $hours): Collection
    {
        $free = $this->availability($orgId, $date, $start, $end);

        return RentalItem::query()
            ->forOrganization($orgId)
            ->rentable()
            ->get()
            ->map(function (RentalItem $item) use ($free, $hours) {
                $item->setAttribute('available_qty', $free[$item->id] ?? 0);
                $item->setAttribute('price_for_booking', $item->priceFor($hours));

                return $item;
            });
    }
}
