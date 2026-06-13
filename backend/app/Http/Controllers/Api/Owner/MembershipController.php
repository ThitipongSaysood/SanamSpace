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
}
