<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesOrganization;
use App\Http\Controllers\Controller;
use App\Http\Resources\PromotionResource;
use App\Models\Promotion;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PromotionController extends Controller
{
    use ResolvesOrganization;

    /**
     * GET /promotions -> Promotion[]
     *
     * Same org resolution as packages — strictly the current venue's.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $org = $this->resolveOrganizationOrFail($request, $request->query('venueId'));

        $promotions = Promotion::query()
            ->forOrganization($org->id)
            ->where('is_active', true)
            ->with('coupon')
            ->orderBy('sort_order')
            ->orderBy('created_at')
            ->get();

        return PromotionResource::collection($promotions);
    }
}
