<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesOrganization;
use App\Http\Controllers\Controller;
use App\Http\Resources\VenuePackageResource;
use App\Models\VenuePackage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PackageController extends Controller
{
    use ResolvesOrganization;

    /**
     * GET /packages -> VenuePackage[]
     *
     * Org = authenticated customer's org if present, else ?venueId slug, else
     * the default org.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $org = $this->resolveOrganization($request, $request->query('venueId'));

        $packages = VenuePackage::query()
            ->forOrganization($org?->id)
            ->orderBy('sort_order')
            ->orderBy('created_at')
            ->get();

        return VenuePackageResource::collection($packages);
    }
}
