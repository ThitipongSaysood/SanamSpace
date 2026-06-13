<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesOrganization;
use App\Http\Controllers\Controller;
use App\Http\Resources\ReviewSummaryResource;
use App\Models\Branch;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    use ResolvesOrganization;

    /**
     * GET /reviews?venueId={slug|branchId} -> ReviewSummary
     *
     * venueId is the organization slug (matching the Venue id used elsewhere).
     * Falls back to the first branch of the default org when omitted.
     */
    public function index(Request $request): ReviewSummaryResource
    {
        $venueId = $request->query('venueId');

        $branch = Branch::query()
            ->with(['reviews' => fn ($q) => $q->orderBy('sort_order')])
            ->when($venueId, function ($query) use ($venueId) {
                $query->where('id', $venueId)
                    ->orWhereHas('organization', fn ($oq) => $oq->where('slug', $venueId));
            })
            ->orderBy('created_at')
            ->first();

        if (! $branch) {
            // Default org's first branch.
            $org = $this->resolveOrganization($request);
            $branch = Branch::query()
                ->with(['reviews' => fn ($q) => $q->orderBy('sort_order')])
                ->forOrganization($org?->id)
                ->orderBy('created_at')
                ->firstOrFail();
        }

        return new ReviewSummaryResource($branch);
    }
}
