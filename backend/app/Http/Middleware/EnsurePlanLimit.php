<?php

namespace App\Http\Middleware;

use App\Support\PlanLimits;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Enforces a plan's ceiling on a create route: `limit:court`.
 *
 * The sibling of EnsurePlanFeature. That one answers "did this venue pay for
 * this page"; this answers "did it pay for this many". Both fail with 402 for
 * the same reason — the request is fine, the person is fine, the plan is the
 * thing in the way, and only that framing points at an answer the venue can act
 * on.
 *
 * The refusal names the number. "เพิ่มคอร์ทไม่ได้ · แพ็กเกจ Starter รองรับ 4
 * คอร์ท (ใช้อยู่ 4)" tells an owner what to do next; "ไม่สามารถดำเนินการได้"
 * sends them to support.
 *
 * Applied only to the routes that CREATE. Editing and deleting what a venue
 * already has stays open even when it is over its ceiling — a venue that
 * downgrades must still be able to tidy up, and a plan change that locks
 * someone out of their own courts is a worse bug than the one this fixes.
 */
class EnsurePlanLimit
{
    public function handle(Request $request, Closure $next, string $resource): Response
    {
        if ($request->user()?->is_super_admin) {
            return $next($request);
        }

        $orgId = $request->attributes->get('currentOrganizationId');

        if (! PlanLimits::isFull($orgId, $resource)) {
            return $next($request);
        }

        $limit = PlanLimits::limitFor($orgId, $resource);
        $label = PlanLimits::label($resource);

        return response()->json([
            'message' => "แพ็กเกจปัจจุบันรองรับ {$label} ได้ {$limit} รายการ · ใช้ครบแล้ว กรุณาอัปเกรดแพ็กเกจ",
            'code' => 'plan_limit_reached',
            'resource' => $resource,
            'limit' => $limit,
            'used' => PlanLimits::usageFor($orgId, $resource),
        ], 402);
    }
}
