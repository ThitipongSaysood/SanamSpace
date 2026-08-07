<?php

namespace App\Http\Middleware;

use App\Models\Organization;
use App\Services\SubscriptionRenewalService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Locks the Owner Portal once the venue's subscription has lapsed.
 *
 * Deliberately scoped to owner routes only: the venue's customers keep booking
 * as normal. They already paid the venue, and cutting them off would punish
 * the wrong people for an unpaid platform bill.
 *
 * Billing routes stay open — an expired venue that cannot reach its own renewal
 * page has no way back.
 */
class EnsureSubscriptionActive
{
    public function __construct(private SubscriptionRenewalService $renewals) {}

    public function handle(Request $request, Closure $next): Response
    {
        // Runs after ResolveOwnerOrganization, so the org id is already resolved.
        $org = Organization::find($request->attributes->get('currentOrganizationId'));

        if (! $org || $request->is('api/*/owner/billing*')) {
            return $next($request);
        }

        $sub = $this->renewals->currentSubscription($org);

        if ($this->renewals->isExpired($sub)) {
            return response()->json([
                'message' => 'แพ็กเกจของสนามหมดอายุแล้ว กรุณาต่ออายุเพื่อใช้งานต่อ',
                'code' => 'subscription_expired',
                'endsAt' => $sub?->ends_at?->toIso8601String(),
            ], 402); // Payment Required
        }

        return $next($request);
    }
}
