<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesOrganization;
use App\Http\Controllers\Controller;
use App\Http\Resources\VenueResource;
use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class BranchController extends Controller
{
    use ResolvesOrganization;

    /**
     * GET /branches -> Venue[]
     *
     * Only ever the branches of the CURRENT venue (resolved from X-Venue-Slug /
     * ?venueId / the signed-in customer). A venue's customers must never see
     * another venue in the list, so an unresolvable tenant 404s rather than
     * falling back to "every branch on the platform".
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $org = $this->resolveOrganizationOrFail($request);

        $branches = Branch::query()
            ->with(['organization.settings', 'courts'])
            ->forOrganization($org->id)
            ->orderBy('created_at')
            ->get();

        return VenueResource::collection($branches);
    }

    /**
     * GET /branches/{id} -> Venue
     *
     * {id} accepts either an organization slug (frontend venue id) or a branch
     * UUID — either way it is resolved to a tenant and matched against it, so
     * one venue's id can never return another venue's branch.
     */
    public function show(Request $request, string $id): VenueResource
    {
        $org = $this->resolveOrganizationOrFail($request, $id);

        $branch = Branch::query()
            ->with(['organization.settings', 'courts'])
            ->forOrganization($org->id)
            ->where(fn ($q) => $q->where('id', $id)
                ->orWhereHas('organization', fn ($oq) => $oq->where('slug', $id)))
            ->firstOrFail();

        return new VenueResource($branch);
    }
}
