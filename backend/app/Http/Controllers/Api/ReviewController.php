<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesOrganization;
use App\Http\Controllers\Controller;
use App\Http\Resources\ReviewSummaryResource;
use App\Models\Branch;
use App\Models\Review;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    use ResolvesOrganization;

    private const THAI_MONTHS = [
        1 => 'ม.ค.', 2 => 'ก.พ.', 3 => 'มี.ค.', 4 => 'เม.ย.', 5 => 'พ.ค.', 6 => 'มิ.ย.',
        7 => 'ก.ค.', 8 => 'ส.ค.', 9 => 'ก.ย.', 10 => 'ต.ค.', 11 => 'พ.ย.', 12 => 'ธ.ค.',
    ];

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

    /**
     * POST /reviews { venueId, rating, text } -> ReviewSummary
     *
     * The authenticated customer leaves a review for a venue (its first branch).
     * Recomputes the branch's average / count / breakdown so the summary updates.
     */
    public function store(Request $request): ReviewSummaryResource
    {
        $data = $request->validate([
            'venueId' => ['required', 'string'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'text' => ['required', 'string', 'max:1000'],
        ]);

        $customer = $request->user();

        $branch = Branch::query()
            ->where('id', $data['venueId'])
            ->orWhereHas('organization', fn ($oq) => $oq->where('slug', $data['venueId']))
            ->orderBy('created_at')
            ->firstOrFail();

        // Newest first: index orders by sort_order asc, so use min-1.
        $topSort = (int) Review::query()->where('branch_id', $branch->id)->min('sort_order');

        Review::create([
            'organization_id' => $branch->organization_id,
            'branch_id' => $branch->id,
            'author' => $customer->display_name ?: 'ลูกค้า',
            'rating' => $data['rating'],
            'review_date' => $this->thaiDate(),
            'text' => $data['text'],
            'sort_order' => $topSort - 1,
        ]);

        $this->recomputeBranchRating($branch);

        $branch->load(['reviews' => fn ($q) => $q->orderBy('sort_order')]);

        return new ReviewSummaryResource($branch);
    }

    /** Recompute and persist the branch's rating average, count and breakdown. */
    private function recomputeBranchRating(Branch $branch): void
    {
        $reviews = $branch->reviews()->get();
        $breakdown = [1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0];
        foreach ($reviews as $review) {
            $breakdown[(int) $review->rating] = ($breakdown[(int) $review->rating] ?? 0) + 1;
        }

        $branch->update([
            'rating' => $reviews->count() ? round($reviews->avg('rating'), 1) : 0,
            'review_count' => $reviews->count(),
            'rating_breakdown' => $breakdown,
        ]);
    }

    /** Today as a Thai date with Buddhist year, e.g. "14 มิ.ย. 2569". */
    private function thaiDate(): string
    {
        $now = now();

        return $now->day.' '.(self::THAI_MONTHS[$now->month] ?? (string) $now->month).' '.($now->year + 543);
    }
}
