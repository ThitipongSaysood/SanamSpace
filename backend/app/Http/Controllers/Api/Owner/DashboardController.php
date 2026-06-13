<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Court;
use App\Models\Customer;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * GET /owner/dashboard
     *
     * Returns a PLAIN (unwrapped) JSON stats object for the current org:
     * { todayBookings, todayRevenue, pendingSlips, confirmedToday, totalCustomers, courtCount }
     *
     * (Unwrapped because it is a bespoke stats payload, not an API Resource;
     * the owner web consumes these fields at the top level.)
     */
    public function index(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $today = now()->toDateString();

        $todayBookings = Booking::query()
            ->forOrganization($orgId)
            ->where('date', $today)
            ->count();

        $todayRevenue = (float) Booking::query()
            ->forOrganization($orgId)
            ->where('date', $today)
            ->whereIn('status', ['confirmed', 'completed'])
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

        return response()->json([
            'todayBookings' => $todayBookings,
            'todayRevenue' => $todayRevenue,
            'pendingSlips' => $pendingSlips,
            'confirmedToday' => $confirmedToday,
            'totalCustomers' => $totalCustomers,
            'courtCount' => $courtCount,
        ]);
    }
}
