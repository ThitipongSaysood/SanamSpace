<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Payment;
use App\Support\VenueClock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Today, at this venue.
 *
 * The Operations screen was reading the dashboard's aggregate — seven days of
 * revenue, donuts, sport breakdowns — to display four numbers and a list
 * labelled "Timeline วันนี้" that was actually the six most recently *created*
 * bookings. A booking made this morning for next month appeared in "today";
 * today's seventh booking did not appear at all.
 *
 * This answers only what the desk needs before closing: everything happening
 * today, in order, and the things that need somebody to do something.
 */
class OperationsController extends Controller
{
    /** Past this many minutes after the start, nobody has turned up. */
    private const NO_SHOW_GRACE_MINUTES = 15;

    /** Statuses where the customer still holds the court. */
    private const LIVE_STATUSES = ['confirmed', 'completed'];

    public function index(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $now = VenueClock::now($orgId);
        $today = $now->toDateString();
        $hhmm = $now->format('H:i');

        $bookings = Booking::query()
            ->forOrganization($orgId)
            ->where('date', $today)
            ->with(['court', 'customer', 'rentals'])
            ->orderBy('start')
            ->get();

        $live = $bookings->filter(fn (Booking $b) => in_array($b->status, self::LIVE_STATUSES, true));

        return response()->json(['data' => [
            'now' => $hhmm,
            'today' => $today,
            'tiles' => $this->tiles($orgId, $bookings, $live, $hhmm),
            'attention' => [
                'noShow' => $this->noShows($live, $hhmm)->values(),
                'unpaid' => $this->unpaid($live)->values(),
                'equipmentOut' => $this->equipmentOut($live, $hhmm)->values(),
            ],
            'timeline' => $bookings->map(fn (Booking $b) => $this->row($b, $hhmm))->values(),
        ]]);
    }

    private function tiles(?string $orgId, Collection $bookings, Collection $live, string $hhmm): array
    {
        $pendingSlips = Payment::query()
            ->forOrganization($orgId)
            ->where('status', 'pending')
            ->count();

        return [
            'todayBookings' => $bookings->count(),
            'pendingSlips' => $pendingSlips,
            // Not "arriving soon": people who were due and are not here. That is
            // the one somebody has to pick up the phone about.
            'noShow' => $this->noShows($live, $hhmm)->count(),
            'cancelledToday' => $bookings->where('status', 'cancelled')->count(),
            // Money still to collect at the counter today, not revenue.
            'outstanding' => round($live->sum(fn (Booking $b) => $this->outstanding($b)), 2),
        ];
    }

    /**
     * Due, past the grace period, and nobody scanned in.
     *
     * Fifteen minutes because a customer who is five minutes late is just late;
     * a screen that flagged them would cry wolf every hour of the day.
     */
    private function noShows(Collection $live, string $hhmm): Collection
    {
        $cutoff = $this->minutes($hhmm) - self::NO_SHOW_GRACE_MINUTES;

        return $live
            ->filter(fn (Booking $b) => $b->checked_in_at === null
                && $this->minutes($b->start) <= $cutoff
                && $this->minutes($b->end) > $this->minutes($hhmm))
            ->map(fn (Booking $b) => [
                'id' => (string) $b->id,
                'code' => $b->code,
                'courtName' => $b->court?->name,
                'customerName' => $b->customer?->display_name,
                'phone' => $b->customer?->phone,
                'start' => $b->start,
                'lateMinutes' => $this->minutes($hhmm) - $this->minutes($b->start),
            ]);
    }

    /** Confirmed, playing today, and still owing money at the counter. */
    private function unpaid(Collection $live): Collection
    {
        return $live
            ->filter(fn (Booking $b) => $this->outstanding($b) > 0.009)
            ->map(fn (Booking $b) => [
                'id' => (string) $b->id,
                'code' => $b->code,
                'courtName' => $b->court?->name,
                'customerName' => $b->customer?->display_name,
                'start' => $b->start,
                'end' => $b->end,
                'amount' => (float) $b->amount,
                'paidAmount' => (float) $b->paid_amount,
                'outstanding' => round($this->outstanding($b), 2),
            ]);
    }

    /**
     * Rackets that went out and have not come back, on a slot that is over.
     *
     * While the slot is still running the equipment is supposed to be out —
     * flagging it then would mean the list is never empty and so never read.
     */
    private function equipmentOut(Collection $live, string $hhmm): Collection
    {
        return $live
            ->filter(fn (Booking $b) => $this->minutes($b->end) <= $this->minutes($hhmm))
            ->map(function (Booking $b) {
                $outstanding = $b->rentals
                    ->map(fn ($r) => [
                        'name' => $r->name,
                        'qty' => (int) $r->quantity - (int) ($r->returned_qty ?? 0),
                    ])
                    ->filter(fn ($r) => $r['qty'] > 0)
                    ->values();

                return [
                    'id' => (string) $b->id,
                    'code' => $b->code,
                    'courtName' => $b->court?->name,
                    'customerName' => $b->customer?->display_name,
                    'end' => $b->end,
                    'items' => $outstanding,
                ];
            })
            ->filter(fn (array $row) => $row['items']->isNotEmpty());
    }

    private function row(Booking $b, string $hhmm): array
    {
        $started = $this->minutes($b->start) <= $this->minutes($hhmm);
        $ended = $this->minutes($b->end) <= $this->minutes($hhmm);

        return [
            'id' => (string) $b->id,
            'code' => $b->code,
            'courtName' => $b->court?->name,
            'customerId' => $b->customer?->id,
            'customerName' => $b->customer?->display_name,
            'start' => $b->start,
            'end' => $b->end,
            'status' => $b->status,
            'amount' => (float) $b->amount,
            'outstanding' => round($this->outstanding($b), 2),
            'checkedIn' => $b->checked_in_at !== null,
            // Where the desk is in the day, so the list can draw a line at "now"
            // instead of making someone find it by reading times.
            'phase' => match (true) {
                $b->status === 'cancelled' => 'cancelled',
                $started && ! $ended => 'now',
                $ended => 'done',
                default => 'upcoming',
            },
        ];
    }

    /** What is still owed on a booking — never negative, never a refund. */
    private function outstanding(Booking $b): float
    {
        if ($b->status === 'cancelled') {
            return 0.0;
        }

        return max(0, (float) $b->amount - (float) $b->paid_amount);
    }

    private function minutes(?string $hhmm): int
    {
        if (! $hhmm) {
            return 0;
        }

        [$h, $m] = array_pad(array_map('intval', explode(':', $hhmm)), 2, 0);

        return $h * 60 + $m;
    }
}
