<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerSegment;
use Illuminate\Support\Collection;

/**
 * Segments that answer a question, instead of holding a list.
 *
 * `customer_segments.criteria` existed as a column and nothing ever read it, so
 * every segment was a hand-picked list that went stale the moment a customer's
 * behaviour changed. A segment with criteria is now evaluated when it is asked
 * about — "everyone who has not booked in 60 days" is true today, not true on
 * the day someone last pressed save.
 *
 * Hand-picked segments still work exactly as before. A segment with no criteria
 * is static; that is the difference, and it is deliberate — some lists really
 * are hand-made.
 */
class SegmentService
{
    /**
     * Customers matching a criteria object.
     *
     * Unknown keys are ignored rather than throwing: criteria are stored JSON,
     * and a segment saved by a newer version must not break an older one.
     *
     * @param  array<string,mixed>  $criteria
     * @return Collection<int,Customer>
     */
    public function matching(string $orgId, array $criteria, bool $reachableOnly = true): Collection
    {
        $query = Customer::query()->forOrganization($orgId)->with('lineProfiles');

        if ($reachableOnly) {
            // Suppression before any narrowing, for the same reason the audience
            // presets do it: so a new criterion cannot quietly skip it.
            $query->marketingReachable();
        }

        // Cancelled bookings are not visits — counting them would call someone
        // a regular for booking three times and turning up never.
        $active = fn ($q) => $q->where('status', '!=', 'cancelled');

        if (isset($criteria['minBookings'])) {
            $query->whereHas('bookings', $active, '>=', (int) $criteria['minBookings']);
        }

        if (isset($criteria['maxBookings'])) {
            $query->whereHas('bookings', $active, '<=', (int) $criteria['maxBookings']);
        }

        if (isset($criteria['minSpend'])) {
            $query->where('total_spending', '>=', (float) $criteria['minSpend']);
        }

        if (isset($criteria['maxSpend'])) {
            $query->where('total_spending', '<=', (float) $criteria['maxSpend']);
        }

        if (isset($criteria['lastBookingWithinDays'])) {
            $since = now()->subDays((int) $criteria['lastBookingWithinDays'])->toDateString();
            $query->whereHas('bookings', fn ($q) => $active($q)->where('date', '>=', $since));
        }

        if (isset($criteria['notBookedForDays'])) {
            $cutoff = now()->subDays((int) $criteria['notBookedForDays'])->toDateString();
            // Has booked at some point, but not lately — someone who never
            // booked at all is a different story, and a different segment.
            $query->whereHas('bookings', $active)
                ->whereDoesntHave('bookings', fn ($q) => $active($q)->where('date', '>=', $cutoff));
        }

        if (isset($criteria['joinedWithinDays'])) {
            $query->where('created_at', '>=', now()->subDays((int) $criteria['joinedWithinDays']));
        }

        if (isset($criteria['tier'])) {
            $query->whereHas('membership', fn ($q) => $q->where('tier', $criteria['tier']));
        }

        $customers = $query->get();

        // RFM last: it is computed in PHP over the org, so filtering the query
        // first keeps that work proportional to what is actually being asked.
        if (! empty($criteria['rfmLabel'])) {
            $rfm = $this->rfm($orgId);
            $wanted = (array) $criteria['rfmLabel'];

            $customers = $customers->filter(
                fn (Customer $c) => in_array($rfm[$c->id]['label'] ?? null, $wanted, true),
            )->values();
        }

        return $customers;
    }

    /** The members of a segment: its criteria if it has any, its list if not. */
    public function membersOf(CustomerSegment $segment, bool $reachableOnly = true): Collection
    {
        if (filled($segment->criteria)) {
            return $this->matching($segment->organization_id, $segment->criteria, $reachableOnly);
        }

        $members = $segment->members();

        if ($reachableOnly) {
            $members->marketingReachable();
        }

        return $members->with('lineProfiles')->get();
    }

    /**
     * Recency, Frequency, Monetary — scored against this venue's own customers.
     *
     * Scored by rank within the organization rather than against fixed
     * thresholds, because "spends a lot" means something different at a
     * two-court venue than at a twenty-court one. A venue with three customers
     * still gets a usable answer; it just says less.
     *
     * @return array<string,array{recencyDays:?int,frequency:int,monetary:float,r:int,f:int,m:int,label:string}>
     */
    public function rfm(string $orgId): array
    {
        $customers = Customer::query()
            ->forOrganization($orgId)
            ->withCount(['bookings as visit_count' => fn ($q) => $q->where('status', '!=', 'cancelled')])
            ->withMax(['bookings as last_booking_date' => fn ($q) => $q->where('status', '!=', 'cancelled')], 'date')
            ->get();

        if ($customers->isEmpty()) {
            return [];
        }

        $today = now()->startOfDay();

        $rows = $customers->map(function (Customer $c) use ($today) {
            $last = $c->last_booking_date ? \Carbon\Carbon::parse($c->last_booking_date) : null;

            return [
                'id' => $c->id,
                // Null means never booked — not "booked infinitely long ago",
                // which would score them as merely lapsed.
                'recencyDays' => $last ? max(0, $today->diffInDays($last, absolute: true)) : null,
                'frequency' => (int) $c->visit_count,
                'monetary' => (float) $c->total_spending,
            ];
        });

        // Fewer days since the last visit is better, so recency is ranked the
        // other way round from the two counts.
        $rScores = $this->quintiles($rows->pluck('recencyDays', 'id')->all(), ascendingIsBetter: false);
        $fScores = $this->quintiles($rows->pluck('frequency', 'id')->all(), ascendingIsBetter: true);
        $mScores = $this->quintiles($rows->pluck('monetary', 'id')->all(), ascendingIsBetter: true);

        $out = [];
        foreach ($rows as $row) {
            $id = $row['id'];
            $r = $rScores[$id] ?? 1;
            $f = $fScores[$id] ?? 1;
            $m = $mScores[$id] ?? 1;

            $out[$id] = [
                'recencyDays' => $row['recencyDays'],
                'frequency' => $row['frequency'],
                'monetary' => $row['monetary'],
                'r' => $r,
                'f' => $f,
                'm' => $m,
                'label' => $this->label($row['frequency'], $r, $f, $m),
            ];
        }

        return $out;
    }

    /**
     * Score 1–5 by position in the venue's own spread.
     *
     * Normalised so the lowest value scores 1 and the highest scores 5, rather
     * than by count-below/total — that put the *worst* customer at 3 in a
     * two-customer venue and made 5 unreachable. Small venues are the common
     * case here, so the small-sample behaviour has to be the correct one.
     *
     * Ties take the midpoint of the positions they share, so a venue where
     * everyone has booked the same number of times scores everyone 3 rather
     * than everyone 1.
     *
     * Nulls score 1: never having booked is the worst recency there is, and
     * dropping them would leave them unlabelled instead of "lost".
     *
     * @param  array<string,int|float|null>  $values
     * @return array<string,int>
     */
    private function quintiles(array $values, bool $ascendingIsBetter): array
    {
        $present = array_filter($values, fn ($v) => $v !== null);

        if ($present === []) {
            return array_map(fn () => 1, $values);
        }

        $sorted = array_values($present);
        sort($sorted);
        $count = count($sorted);
        $span = max(1, $count - 1);

        $scores = [];
        foreach ($values as $id => $value) {
            if ($value === null) {
                $scores[$id] = $ascendingIsBetter ? 1 : 1;

                continue;
            }

            $below = 0;
            $equal = 0;
            foreach ($sorted as $v) {
                if ($v < $value) {
                    $below++;
                } elseif ($v === $value || abs((float) $v - (float) $value) < 0.00001) {
                    $equal++;
                }
            }

            // Midpoint of the tied block, so equals share a score.
            $position = $below + max(0, $equal - 1) / 2;
            $percentile = $position / $span; // [0, 1]
            $score = (int) max(1, min(5, 1 + (int) round($percentile * 4)));

            $scores[$id] = $ascendingIsBetter ? $score : 6 - $score;
        }

        return $scores;
    }

    /** A name a human can act on, rather than a three-digit code. */
    private function label(int $frequency, int $r, int $f, int $m): string
    {
        if ($frequency === 0) {
            return 'never_booked';
        }

        if ($r >= 4 && $f >= 4) {
            return 'champions';
        }

        if ($f >= 4) {
            return 'loyal';
        }

        if ($r >= 4 && $frequency <= 1) {
            return 'new';
        }

        if ($r >= 4) {
            return 'promising';
        }

        if ($r <= 2 && ($f >= 3 || $m >= 4)) {
            // Was worth a lot and has gone quiet — the one worth a phone call.
            return 'at_risk';
        }

        if ($r <= 2) {
            return 'lost';
        }

        return 'needs_attention';
    }
}
