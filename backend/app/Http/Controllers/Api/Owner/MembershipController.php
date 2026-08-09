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
     * POST /owner/memberships/{id}/points — adjust by `delta`, with a reason.
     *
     * The `note` used to be accepted and thrown away — this method's own comment
     * said so. It is a ledger row now, with the staff member who made it, for
     * the same reason credit adjustments are: points are value staff can create
     * by hand.
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

        app(\App\Services\PointsService::class)->adjust(
            $membership->customer,
            (int) $validated['delta'],
            $validated['note'] ?? null,
            $request->user()?->id,
        );

        return new OwnerMembershipResource($membership->fresh()->load('customer'));
    }
}
