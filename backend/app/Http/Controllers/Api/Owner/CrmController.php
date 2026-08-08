<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Customer;
use App\Models\CustomerSegment;
use Illuminate\Http\JsonResponse;
use App\Services\SegmentService;
use Illuminate\Http\Request;

class CrmController extends Controller
{
    /**
     * GET /owner/crm/overview
     *
     * Bespoke (unwrapped) CRM summary for the current org:
     *   { totalCustomers, newCustomers30d, inactive30d, vipCount,
     *     segmentDistribution: [{ name, count }] }
     *
     * Definitions (assumptions, see below):
     * - newCustomers30d: customers created within the last 30 days.
     * - inactive30d: customers with NO booking in the last 30 days (real
     *   booking-date check against the org's bookings, not the visits proxy).
     * - vipCount: number of customers in the segment named "VIP" (segment-based,
     *   chosen so it lines up with segmentDistribution and the seed).
     * - segmentDistribution: each org segment's name + its member count.
     */
    /**
     * GET /owner/crm/rfm — the venue's customers scored by Recency, Frequency
     * and Monetary value, grouped into names staff can act on.
     *
     * Scored by rank within this venue, not against fixed thresholds: "spends a
     * lot" means something different at a two-court venue than a twenty-court
     * one.
     */
    public function rfm(Request $request, SegmentService $segments): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $scores = $segments->rfm($orgId);

        $groups = [];
        foreach ($scores as $row) {
            $groups[$row['label']] = ($groups[$row['label']] ?? 0) + 1;
        }

        arsort($groups);

        return response()->json([
            'total' => count($scores),
            'groups' => $groups,
            // A distribution alone is not actionable — these are the ones worth
            // a phone call, so they come with names attached.
            'atRisk' => $this->named($orgId, $scores, 'at_risk'),
            'champions' => $this->named($orgId, $scores, 'champions'),
        ]);
    }

    /** @return array<int,array{id:string,name:?string,lastSeenDays:?int,spend:float}> */
    private function named(string $orgId, array $scores, string $label): array
    {
        $ids = array_keys(array_filter($scores, fn ($r) => $r['label'] === $label));

        if ($ids === []) {
            return [];
        }

        return \App\Models\Customer::query()
            ->forOrganization($orgId)
            ->whereIn('id', array_slice($ids, 0, 20))
            ->get()
            ->map(fn ($c) => [
                'id' => (string) $c->id,
                'name' => $c->display_name,
                'lastSeenDays' => $scores[$c->id]['recencyDays'] ?? null,
                'spend' => (float) $c->total_spending,
            ])
            ->values()
            ->all();
    }

    public function overview(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $since = now()->subDays(30);

        $totalCustomers = Customer::query()
            ->forOrganization($orgId)
            ->count();

        $newCustomers30d = Customer::query()
            ->forOrganization($orgId)
            ->where('created_at', '>=', $since)
            ->count();

        // Customers with at least one booking dated within the last 30 days.
        // Bookings store `date` as a plain "Y-m-d" string, so compare on that.
        $activeCustomerIds = Booking::query()
            ->forOrganization($orgId)
            ->where('date', '>=', $since->toDateString())
            ->distinct()
            ->pluck('customer_id');

        $inactive30d = Customer::query()
            ->forOrganization($orgId)
            ->whereNotIn('id', $activeCustomerIds)
            ->count();

        $vipCount = CustomerSegment::query()
            ->forOrganization($orgId)
            ->where('name', 'VIP')
            ->withCount('members')
            ->get()
            ->sum('members_count');

        $segmentDistribution = CustomerSegment::query()
            ->forOrganization($orgId)
            ->withCount('members')
            ->orderBy('created_at')
            ->get()
            ->map(fn ($segment) => [
                'name' => $segment->name,
                'count' => (int) $segment->members_count,
            ])
            ->values();

        return response()->json([
            'totalCustomers' => $totalCustomers,
            'newCustomers30d' => $newCustomers30d,
            'inactive30d' => $inactive30d,
            'vipCount' => (int) $vipCount,
            'segmentDistribution' => $segmentDistribution,
        ]);
    }
}
