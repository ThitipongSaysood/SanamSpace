<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Customer;
use App\Models\CustomerSegment;
use Illuminate\Http\JsonResponse;
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
