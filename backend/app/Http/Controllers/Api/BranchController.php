<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\VenueResource;
use App\Models\Branch;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class BranchController extends Controller
{
    /**
     * GET /branches -> Venue[]
     */
    public function index(): AnonymousResourceCollection
    {
        $branches = Branch::query()
            ->with(['organization.settings', 'courts'])
            ->orderBy('created_at')
            ->get();

        return VenueResource::collection($branches);
    }

    /**
     * GET /branches/{id} -> Venue
     *
     * {id} accepts either an organization slug (frontend venue id) or a
     * branch UUID.
     */
    public function show(string $id): VenueResource
    {
        $branch = $this->resolveBranch($id);

        return new VenueResource($branch);
    }

    private function resolveBranch(string $id): Branch
    {
        return Branch::query()
            ->with(['organization.settings', 'courts'])
            ->where('id', $id)
            ->orWhereHas('organization', fn ($q) => $q->where('slug', $id))
            ->firstOrFail();
    }
}
