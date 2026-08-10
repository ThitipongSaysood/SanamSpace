<?php

namespace App\Http\Middleware;

use App\Support\PlanLimits;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Symfony\Component\HttpFoundation\Response;

/**
 * Enforces a plan's `storage_gb` ceiling on an OWNER upload route.
 *
 * The storage sibling of EnsurePlanLimit. Applied only where a venue
 * deliberately adds content it owns (venue images / banners), never to a
 * customer's payment slip or the owner's own bill-paying slip — turning those
 * away to enforce storage billing would take the venue's revenue, the mistake
 * the booking limit already refuses to make.
 *
 * Refuses with 402 naming the number, like the other plan gates, and counts the
 * bytes already in flight so one oversized file can't slip over the line.
 */
class EnsureStorageLimit
{
    public function handle(Request $request, Closure $next, string $field = 'file'): Response
    {
        if ($request->user()?->is_super_admin) {
            return $next($request);
        }

        $orgId = $request->attributes->get('currentOrganizationId');

        $incoming = 0;
        foreach (Arr::wrap($request->file($field)) as $file) {
            $incoming += $file?->getSize() ?? 0;
        }

        if (! PlanLimits::storageWouldExceed($orgId, $incoming)) {
            return $next($request);
        }

        $limitGb = (int) round((PlanLimits::storageLimitBytes($orgId) ?? 0) / 1073741824);

        return response()->json([
            'message' => "พื้นที่จัดเก็บเต็มแล้ว · แพ็กเกจปัจจุบันรองรับ {$limitGb} GB กรุณาอัปเกรดแพ็กเกจ",
            'code' => 'storage_limit_reached',
            'limitBytes' => PlanLimits::storageLimitBytes($orgId),
            'usedBytes' => $orgId ? PlanLimits::storageUsedBytes($orgId) : 0,
        ], 402);
    }
}
