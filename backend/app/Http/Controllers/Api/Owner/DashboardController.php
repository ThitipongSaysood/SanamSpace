<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Court;
use App\Models\Customer;
use App\Models\Payment;
use App\Models\Wallet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Support\VenueClock;
use Illuminate\Support\Carbon;

class DashboardController extends Controller
{
    /**
     * Assumed daily opening window (hours) used to compute court utilization.
     * No per-org opening-hours model exists yet, so this is a fixed baseline.
     */
    private const OPEN_HOURS_PER_DAY = 12;

    /** Booking statuses that count as realised revenue. */
    private const REVENUE_STATUSES = ['confirmed', 'completed'];

    /**
     * GET /owner/dashboard
     *
     * Returns a PLAIN (unwrapped) JSON stats object for the current org. Kept
     * unwrapped (not an API Resource) because it is a bespoke dashboard payload
     * the owner web consumes at the top level.
     *
     * Existing keys: todayBookings, todayRevenue, pendingSlips, confirmedToday,
     * totalCustomers, courtCount.
     *
     * Added for the redesigned dashboard: newCustomersToday, utilizationRate,
     * walletBalance, revenueSeries, statusBreakdown, sportSales, bookingChannels,
     * actionItems, recentBookings. Everything is org-scoped and derived from real
     * booking / payment / court / customer / wallet data.
     */
    public function index(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        // The venue's clock, not the server's. Bookings hold wall-clock times,
        // so a UTC "today" reports yesterday's numbers until 07:00 in Bangkok.
        $now = VenueClock::now($orgId);
        $today = $now->toDateString();

        // --- Existing top-line stats ---
        $todayBookings = Booking::query()
            ->forOrganization($orgId)
            ->where('date', $today)
            ->count();

        $todayRevenue = (float) Booking::query()
            ->forOrganization($orgId)
            ->where('date', $today)
            ->whereIn('status', self::REVENUE_STATUSES)
            ->sum('amount');

        $confirmedToday = Booking::query()
            ->forOrganization($orgId)
            ->where('date', $today)
            ->where('status', 'confirmed')
            ->count();

        $pendingSlips = Payment::query()
            ->forOrganization($orgId)
            ->where('status', 'pending_review')
            ->count();

        $totalCustomers = Customer::query()
            ->forOrganization($orgId)
            ->count();

        $courtCount = Court::query()
            ->forOrganization($orgId)
            ->count();

        // --- New: customers created today in this org ---
        $newCustomersToday = Customer::query()
            ->forOrganization($orgId)
            ->whereDate('created_at', $today)
            ->count();

        // --- New: court utilization today ---
        // bookedHoursToday / (courtCount * OPEN_HOURS_PER_DAY), rounded to int.
        // Counts non-cancelled bookings (any active reservation occupies a slot).
        $bookedHoursToday = Booking::query()
            ->forOrganization($orgId)
            ->where('date', $today)
            ->where('status', '!=', 'cancelled')
            ->get(['start', 'end'])
            ->sum(fn (Booking $b) => $this->slotHours($b->start, $b->end));

        $capacityHours = $courtCount * self::OPEN_HOURS_PER_DAY;
        $utilizationRate = $capacityHours > 0
            ? (int) round(($bookedHoursToday / $capacityHours) * 100)
            : 0;

        // --- New: sum of org wallet balances (wallets table exists) ---
        $walletBalance = (float) Wallet::query()
            ->forOrganization($orgId)
            ->sum('balance');

        // --- New: revenue for the last 7 days (confirmed|completed), zero-filled ---
        $revenueSeries = $this->revenueSeries($orgId, $now);

        // --- New: booking status breakdown for the org ---
        $statusBreakdown = $this->statusBreakdown($orgId);

        // --- New: sales grouped by the court's sport ---
        $sportSales = $this->sportSales($orgId);

        // --- New: booking channels (real, grouped by bookings.channel) ---
        $bookingChannels = $this->bookingChannels($orgId);

        // --- New: action items for the "things to do" panel ---
        $cancelledToday = Booking::query()
            ->forOrganization($orgId)
            ->where('date', $today)
            ->where('status', 'cancelled')
            ->count();

        $nearTime = $this->nearTimeCount($orgId, $now);

        $actionItems = [
            'pendingSlips' => $pendingSlips,
            'nearTime' => $nearTime,
            'todayBookings' => $todayBookings,
            'cancelledToday' => $cancelledToday,
        ];

        // --- New: latest 6 bookings ---
        $recentBookings = $this->recentBookings($orgId);

        // --- Real day-over-day deltas (% vs yesterday) ---
        $yesterday = $now->copy()->subDay()->toDateString();
        $yBookings = Booking::query()->forOrganization($orgId)->where('date', $yesterday)->count();
        $yRevenue = (float) Booking::query()->forOrganization($orgId)->where('date', $yesterday)
            ->whereIn('status', self::REVENUE_STATUSES)->sum('amount');
        $yNewCustomers = Customer::query()->forOrganization($orgId)->whereDate('created_at', $yesterday)->count();
        $deltas = [
            'todayRevenue' => $this->pctDelta($todayRevenue, $yRevenue),
            'todayBookings' => $this->pctDelta($todayBookings, $yBookings),
            'newCustomersToday' => $this->pctDelta($newCustomersToday, $yNewCustomers),
        ];

        return response()->json([
            // existing
            'todayBookings' => $todayBookings,
            'todayRevenue' => $todayRevenue,
            'deltas' => $deltas,
            'pendingSlips' => $pendingSlips,
            'confirmedToday' => $confirmedToday,
            'totalCustomers' => $totalCustomers,
            'courtCount' => $courtCount,
            // new
            'newCustomersToday' => $newCustomersToday,
            'utilizationRate' => $utilizationRate,
            'walletBalance' => $walletBalance,
            'revenueSeries' => $revenueSeries,
            'statusBreakdown' => $statusBreakdown,
            'sportSales' => $sportSales,
            'bookingChannels' => $bookingChannels,
            'actionItems' => $actionItems,
            'recentBookings' => $recentBookings,
        ]);
    }

    /** Percent change from $prev to $curr, rounded to 1 decimal. */
    private function pctDelta(float $curr, float $prev): float
    {
        if ($prev <= 0) {
            return $curr > 0 ? 100.0 : 0.0;
        }

        return round((($curr - $prev) / $prev) * 100, 1);
    }

    /**
     * Duration in hours between two "HH:MM" slot endpoints. Returns 0 for
     * malformed or non-positive ranges so bad rows never distort utilization.
     */
    private function slotHours(?string $start, ?string $end): float
    {
        if (! $start || ! $end) {
            return 0.0;
        }

        [$sh, $sm] = array_pad(array_map('intval', explode(':', $start)), 2, 0);
        [$eh, $em] = array_pad(array_map('intval', explode(':', $end)), 2, 0);

        $minutes = ($eh * 60 + $em) - ($sh * 60 + $sm);

        return $minutes > 0 ? $minutes / 60 : 0.0;
    }

    /**
     * Confirmed|completed revenue grouped by booking date for the last 7 days
     * (oldest first), with missing days filled as 0.
     *
     * @return list<array{date: string, revenue: float}>
     */
    private function revenueSeries(?string $orgId, Carbon $now): array
    {
        $start = $now->copy()->subDays(6)->toDateString();

        $byDate = Booking::query()
            ->forOrganization($orgId)
            ->whereIn('status', self::REVENUE_STATUSES)
            ->whereBetween('date', [$start, $now->toDateString()])
            ->selectRaw('date, SUM(amount) as revenue')
            ->groupBy('date')
            ->pluck('revenue', 'date');

        $series = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = $now->copy()->subDays($i)->toDateString();
            $series[] = [
                'date' => $date,
                'revenue' => (float) ($byDate[$date] ?? 0),
            ];
        }

        return $series;
    }

    /**
     * Org booking counts by status. `pending` maps to the `pending_payment`
     * status; `total` is all (non-soft-deleted) org bookings.
     *
     * @return array{total: int, confirmed: int, pending: int, cancelled: int, completed: int}
     */
    private function statusBreakdown(?string $orgId): array
    {
        $counts = Booking::query()
            ->forOrganization($orgId)
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        return [
            'total' => (int) $counts->sum(),
            'confirmed' => (int) ($counts['confirmed'] ?? 0),
            'pending' => (int) ($counts['pending_payment'] ?? 0),
            'cancelled' => (int) ($counts['cancelled'] ?? 0),
            'completed' => (int) ($counts['completed'] ?? 0),
        ];
    }

    /**
     * Confirmed|completed sales grouped by the booked court's sport, ordered by
     * revenue desc. The sport label is the Thai display name where known, else
     * the raw sport code.
     *
     * @return list<array{sport: string, revenue: float, count: int}>
     */
    private function sportSales(?string $orgId): array
    {
        return Booking::query()
            ->forOrganization($orgId)
            ->join('courts', 'bookings.court_id', '=', 'courts.id')
            ->whereIn('bookings.status', self::REVENUE_STATUSES)
            ->groupBy('courts.sport')
            ->selectRaw('courts.sport as sport, SUM(bookings.amount) as revenue, COUNT(*) as count')
            ->orderByDesc('revenue')
            ->get()
            ->map(fn ($row) => [
                'sport' => $this->sportLabel($row->sport),
                'revenue' => (float) $row->revenue,
                'count' => (int) $row->count,
            ])
            ->all();
    }

    /**
     * Count of confirmed bookings today whose start time is within the next
     * 2 hours of now. Used by the "starting soon" action item.
     */
    private function nearTimeCount(?string $orgId, Carbon $now): int
    {
        $windowEnd = $now->copy()->addHours(2);

        return Booking::query()
            ->forOrganization($orgId)
            ->where('date', $now->toDateString())
            ->where('status', 'confirmed')
            ->get(['start'])
            ->filter(function (Booking $b) use ($now, $windowEnd) {
                if (! $b->start) {
                    return false;
                }
                [$h, $m] = array_pad(array_map('intval', explode(':', $b->start)), 2, 0);
                $startAt = $now->copy()->setTime($h, $m, 0);

                return $startAt->betweenIncluded($now, $windowEnd);
            })
            ->count();
    }

    /**
     * Latest 6 org bookings as a flat shape the dashboard list consumes.
     *
     * @return list<array{id: string, code: string, customerName: ?string, courtName: ?string, date: string, start: string, end: string, amount: float, status: string}>
     */
    private function recentBookings(?string $orgId): array
    {
        return Booking::query()
            ->forOrganization($orgId)
            ->with(['court', 'customer'])
            ->orderByDesc('created_at')
            ->limit(6)
            ->get()
            ->map(fn (Booking $b) => [
                'id' => (string) $b->id,
                'code' => $b->code,
                'customerId' => $b->customer?->id,
                'customerName' => $b->customer?->display_name,
                'courtName' => $b->court?->name,
                'date' => $b->date,
                'start' => $b->start,
                'end' => $b->end,
                'amount' => (float) $b->amount,
                'status' => $b->status,
            ])
            ->all();
    }

    /** Real booking counts grouped by channel, with Thai labels (excludes cancelled). */
    private function bookingChannels(string $orgId): array
    {
        return Booking::query()
            ->forOrganization($orgId)
            ->where('status', '!=', 'cancelled')
            ->selectRaw('channel, COUNT(*) as c')
            ->groupBy('channel')
            ->orderByDesc('c')
            ->get()
            ->map(fn ($row) => ['channel' => $this->channelLabel($row->channel), 'count' => (int) $row->c])
            ->all();
    }

    /** Thai display label for a booking channel code, falling back to the code itself. */
    private function channelLabel(?string $channel): string
    {
        return match ($channel) {
            'application' => 'แอปพลิเคชัน',
            'walk_in' => 'หน้าเคาน์เตอร์',
            'phone' => 'โทรศัพท์',
            'admin' => 'แอดมิน',
            default => (string) $channel,
        };
    }

    /** Thai display label for a sport code, falling back to the code itself. */
    private function sportLabel(?string $sport): string
    {
        return match ($sport) {
            'badminton' => 'แบดมินตัน',
            'futsal' => 'ฟุตซอล',
            'football' => 'ฟุตบอล',
            'tennis' => 'เทนนิส',
            default => (string) $sport,
        };
    }
}
