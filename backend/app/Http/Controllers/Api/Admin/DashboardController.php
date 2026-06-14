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

        $activeOrganizations = (int) Subscription::query()
            ->where('status', 'active')
            ->distinct('organization_id')
            ->count('organization_id');

        // MRR split by plan (donut)
        $revenueByPlan = Subscription::query()
            ->where('subscriptions.status', 'active')
            ->join('plans', 'plans.id', '=', 'subscriptions.plan_id')
            ->groupBy('plans.name')
            ->selectRaw('plans.name as plan, SUM(plans.price) as amount')
            ->get()
            ->map(fn ($r) => ['plan' => $r->plan, 'amount' => (float) $r->amount])
            ->values();

        // Monthly booking revenue — last 7 months (line chart)
        $thMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        $revenueSeries = [];
        for ($i = 6; $i >= 0; $i--) {
            $m = now()->subMonths($i);
            $sum = (float) Booking::query()
                ->whereIn('status', ['confirmed', 'completed'])
                ->whereYear('created_at', $m->year)
                ->whereMonth('created_at', $m->month)
                ->sum('amount');
            $revenueSeries[] = ['label' => $thMonths[$m->month - 1], 'revenue' => $sum];
        }

        // Top organizations by booking revenue
        $topOrganizations = Booking::query()
            ->whereIn('bookings.status', ['confirmed', 'completed'])
            ->join('organizations', 'organizations.id', '=', 'bookings.organization_id')
            ->groupBy('organizations.id', 'organizations.name')
            ->selectRaw('organizations.name as name, SUM(bookings.amount) as revenue')
            ->orderByDesc('revenue')
            ->limit(5)
            ->get()
            ->map(fn ($r) => ['name' => $r->name, 'revenue' => (float) $r->revenue])
            ->values();

        return response()->json([
            'totalOrganizations' => $totalOrganizations,
            'activeOrganizations' => $activeOrganizations,
            'activeSubscriptions' => $activeSubscriptions,
            'totalBookings' => $totalBookings,
            'totalRevenue' => $totalRevenue,
            'totalCustomers' => $totalCustomers,
            'mrr' => $mrr,
            'revenueByPlan' => $revenueByPlan,
            'revenueSeries' => $revenueSeries,
            'topOrganizations' => $topOrganizations,
        ]);
    }
}
