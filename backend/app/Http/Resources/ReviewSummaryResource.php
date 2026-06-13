<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Maps a Branch (+ its reviews) to the frontend `ReviewSummary` shape
 * (lib/types.ts):
 * { average, total, breakdown: {1..5:number}, reviews: [{id,author,rating,date,text}] }
 *
 * average/total reuse the branch's rating/review_count. The breakdown is the
 * branch's rating_breakdown JSON, normalised to keys 1..5.
 */
class ReviewSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $breakdown = $this->rating_breakdown ?? [];

        return [
            'average' => (float) $this->rating,
            'total' => (int) $this->review_count,
            // Cast to object so JSON encodes keyed {"1":..,"5":..} (the
            // frontend Record<1..5, number>), not a positional array.
            'breakdown' => (object) [
                '1' => (int) ($breakdown[1] ?? $breakdown['1'] ?? 0),
                '2' => (int) ($breakdown[2] ?? $breakdown['2'] ?? 0),
                '3' => (int) ($breakdown[3] ?? $breakdown['3'] ?? 0),
                '4' => (int) ($breakdown[4] ?? $breakdown['4'] ?? 0),
                '5' => (int) ($breakdown[5] ?? $breakdown['5'] ?? 0),
            ],
            'reviews' => $this->reviews->map(fn ($review) => [
                'id' => (string) $review->id,
                'author' => $review->author,
                'rating' => (int) $review->rating,
                'date' => $review->review_date,
                'text' => $review->text,
            ])->values(),
        ];
    }
}
