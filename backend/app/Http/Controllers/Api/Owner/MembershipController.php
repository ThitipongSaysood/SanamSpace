<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerMembershipResource;
use App\Models\Membership;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class MembershipController extends Controller
{
    /**
     * GET /owner/memberships — org memberships joined to their customer.
     * Each item: { id, customerName, tier, memberId, points, expiresAt }
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $memberships = Membership::query()
            ->forOrganization($orgId)
            ->with('customer')
            ->orderByDesc('points')
            ->get();

        return OwnerMembershipResource::collection($memberships);
    }

    /**
     * POST /owner/memberships/{id}/points — adjust a membership's points by
     * `delta` (can be negative). Result is floored at 0. Org-scoped (404 cross-org).
     * The optional `note` is accepted for audit intent but not persisted (no
     * points-ledger table yet).
     */
    public function adjustPoints(Request $request, string $id): OwnerMembershipResource
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $validated = $request->validate([
            'delta' => ['required', 'integer'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $membership = Membership::query()
            ->forOrganization($orgId)
            ->where('id', $id)
            ->firstOrFail();

        $membership->update([
            'points' => max(0, (int) $membership->points + $validated['delta']),
        ]);

        return new OwnerMembershipResource($membership->fresh()->load('customer'));
    }
}
