<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\CourtResource;
use App\Models\Court;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CourtController extends Controller
{
    /**
     * GET /owner/courts — courts for the current org (reuses CourtResource).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $courts = Court::query()
            ->forOrganization($orgId)
            ->with('branch.organization')
            ->orderBy('sort_order')
            ->get();

        return CourtResource::collection($courts);
    }
}
