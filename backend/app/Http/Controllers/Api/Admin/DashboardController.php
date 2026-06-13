<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Customer;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    /**
     * GET /admin/dashboard
     *
     * Platform-wide stats across ALL organizations (PLAIN/unwrapped JSON):
     * { totalOrganizations, activeSubscriptions, totalBookings,
     *   totalRevenue, totalCustomers, mrr }
     *
     * - totalRevenue = sum of confirmed|completed booking amounts (all orgs)
     * - mrr          = sum of active subscriptions' plan prices
     */
    public function index(): JsonResponse
    {
        $totalOrganizations = Organization::count();
        $activeSubscriptions = Subscription::where('status', 'active')->count();
        $totalBookings = Booking::count();
        $totalCustomers = Customer::count();

        $totalRevenue = (float) Booking::query()
            ->whereIn('status', ['confirmed', 'completed'])
            ->sum('amount');

        $mrr = (float) Subscription::query()
            ->where('subscriptions.status', 'active')
            ->join('plans', 'plans.id', '=', 'subscriptions.plan_id')
            ->sum('plans.price');

        return response()->json([
            'totalOrganizations' => $totalOrganizations,
            'activeSubscriptions' => $activeSubscriptions,
            'totalBookings' => $totalBookings,
            'totalRevenue' => $totalRevenue,
            'totalCustomers' => $totalCustomers,
            'mrr' => $mrr,
        ]);
    }
}
