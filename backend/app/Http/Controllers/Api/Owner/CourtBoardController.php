<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Court;
use App\Support\VenueClock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * The floor, right now.
 *
 * The question staff actually ask while standing at the counter — which courts
 * have someone on them, how much longer, and who is up next — could only be
 * answered by reading the day's booking list and doing the arithmetic in your
 * head. This answers it directly.
 *
 * Everything is computed on the **venue's** clock (see VenueClock): bookings
 * store wall-clock times, so a board built on the server's UTC would show the
 * morning's courts as occupied all afternoon.
 */
class CourtBoardController extends Controller
{
    /** Statuses that mean somebody has the court. */
    private const HOLDS_THE_COURT = ['confirmed', 'completed'];

    /**
     * GET /owner/courts/live
     *
     * One entry per court, grouped by branch so the board reads like the venue
     * is laid out rather than like a database table.
     */
    public function index(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $now = VenueClock::now($orgId);
        $today = $now->toDateString();

        $courts = Court::query()
            ->forOrganization($orgId)
            ->with('branch')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        // The whole day in one query: a per-court query would be one round trip
        // per court on a screen that refreshes itself every half minute.
        $bookings = Booking::query()
            ->forOrganization($orgId)
            ->where('date', $today)
            ->whereIn('status', self::HOLDS_THE_COURT)
            ->with('customer')
            ->orderBy('start')
            ->get()
            ->groupBy('court_id');

        $branches = $courts
            ->groupBy(fn (Court $c) => $c->branch_id)
            ->map(fn ($group) => [
                'id' => (string) $group->first()->branch_id,
                'name' => $group->first()->branch?->name,
                'courts' => $group->map(fn (Court $c) => $this->court($c, $bookings->get($c->id) ?? collect(), $now))->values(),
            ])
            ->values();

        return response()->json(['data' => [
            // Sent so the screen can say which clock it is showing. A board that
            // disagrees with the wall clock is worse than no board.
            'now' => $now->format('H:i'),
            'timezone' => $now->timezoneName,
            'branches' => $branches,
        ]]);
    }

    private function court(Court $court, $todaysBookings, Carbon $now): array
    {
        $hhmm = $now->format('H:i');

        $current = $todaysBookings->first(fn (Booking $b) => $b->start <= $hhmm && $b->end > $hhmm);

        // The next one that has not started. Not "the next row": a court can be
        // free now with something booked in an hour, and that hour is exactly
        // what the desk needs to know before offering it to a walk-in.
        $next = $todaysBookings->first(fn (Booking $b) => $b->start > $hhmm);

        return [
            'id' => (string) $court->id,
            'name' => $court->name,
            'sport' => $court->sport,
            'status' => $current ? 'playing' : 'free',
            'current' => $current ? [
                'bookingId' => (string) $current->id,
                'code' => $current->code,
                'customerId' => $current->customer?->id,
                'customerName' => $current->customer?->display_name,
                'start' => $current->start,
                'end' => $current->end,
                'minutesLeft' => $this->minutesBetween($hhmm, $current->end),
                // Booked and playing are not the same thing. A court whose
                // customer never checked in is the one to walk over and look at.
                'checkedIn' => $current->checked_in_at !== null,
            ] : null,
            'next' => $next ? [
                'bookingId' => (string) $next->id,
                'customerId' => $next->customer?->id,
                'customerName' => $next->customer?->display_name,
                'start' => $next->start,
                'end' => $next->end,
                'minutesUntil' => $this->minutesBetween($hhmm, $next->start),
            ] : null,
        ];
    }

    /** Whole minutes from one wall-clock time to another, never negative. */
    private function minutesBetween(string $from, ?string $to): int
    {
        if (! $to) {
            return 0;
        }

        return max(0, $this->toMinutes($to) - $this->toMinutes($from));
    }

    private function toMinutes(string $hhmm): int
    {
        [$h, $m] = array_pad(array_map('intval', explode(':', $hhmm)), 2, 0);

        return $h * 60 + $m;
    }
}
