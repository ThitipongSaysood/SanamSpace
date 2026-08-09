<?php

namespace App\Http\Middleware;

use App\Support\PlanFeatures;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Enforces the plan on an owner route: `feature:pos`.
 *
 * The counterpart to EnsurePermission. That one asks "may this member of staff
 * do it"; this asks "did this venue pay for it". Both have to hold, and they
 * fail differently on purpose: a permission failure is about the person and
 * cannot be fixed by them, while this one names the plan and can.
 *
 * Super admins pass, because they support venues from the platform side and
 * cannot do that through a paywall.
 */
class EnsurePlanFeature
{
    public function handle(Request $request, Closure $next, string $feature): Response
    {
        if ($request->user()?->is_super_admin) {
            return $next($request);
        }

        $orgId = $request->attributes->get('currentOrganizationId');

        if (PlanFeatures::allows($orgId, $feature)) {
            return $next($request);
        }

        // 402 rather than 403: nothing is wrong with the request or the person
        // making it, and the client shows an upgrade prompt rather than "you do
        // not have permission", which would send them to their manager.
        return response()->json([
            'message' => 'แพ็กเกจปัจจุบันยังไม่รวมฟีเจอร์นี้',
            'code' => 'feature_not_in_plan',
            'feature' => $feature,
        ], 402);
    }
}
