<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerSegmentResource;
use App\Models\CustomerSegment;
use App\Services\SegmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SegmentController extends Controller
{
    /**
     * GET /owner/segments — org customer segments with member counts.
     * Each item: { id, name, description, memberCount }
     */
    public function __construct(private SegmentService $segments) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $segments = CustomerSegment::query()
            ->forOrganization($orgId)
            ->withCount('members')
            ->orderBy('created_at')
            ->get();

        // A dynamic segment's size is a question, not a stored number, so the
        // pivot count would report 0 for every one of them.
        foreach ($segments as $segment) {
            if (filled($segment->criteria)) {
                $segment->members_count = $this->segments
                    ->matching($orgId, $segment->criteria, reachableOnly: false)
                    ->count();
            }
        }

        return OwnerSegmentResource::collection($segments);
    }

    /**
     * GET /owner/segments/{id}/members — who is in it right now.
     *
     * "Right now" is the point for a dynamic segment: the answer changes as
     * customers do, and the owner needs to see who they are about to message.
     */
    public function members(Request $request, string $id): JsonResponse
    {
        $segment = CustomerSegment::query()
            ->forOrganization($request->attributes->get('currentOrganizationId'))
            ->where('id', $id)
            ->firstOrFail();

        $members = $this->segments->membersOf($segment, reachableOnly: false);

        return response()->json([
            'data' => $members->map(fn ($c) => [
                'id' => (string) $c->id,
                'displayName' => $c->display_name,
                'phone' => $c->phone,
                'totalSpending' => (float) $c->total_spending,
                'visits' => (int) $c->visits,
            ])->values(),
            'dynamic' => filled($segment->criteria),
        ]);
    }

    /**
     * POST /owner/segments — create a segment in the current org.
     *
     * With `criteria` it is a live question; without, a hand-picked list. Both
     * are useful, so both are kept.
     */
    public function store(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'criteria' => ['nullable', 'array'],
            'criteria.minBookings' => ['nullable', 'integer', 'min:0'],
            'criteria.maxBookings' => ['nullable', 'integer', 'min:0'],
            'criteria.minSpend' => ['nullable', 'numeric', 'min:0'],
            'criteria.maxSpend' => ['nullable', 'numeric', 'min:0'],
            'criteria.lastBookingWithinDays' => ['nullable', 'integer', 'min:1'],
            'criteria.notBookedForDays' => ['nullable', 'integer', 'min:1'],
            'criteria.joinedWithinDays' => ['nullable', 'integer', 'min:1'],
            'criteria.tier' => ['nullable', 'string', 'max:40'],
            'criteria.rfmLabel' => ['nullable', 'array'],
            'criteria.rfmLabel.*' => ['string', 'max:40'],
        ]);

        // Empty-but-present criteria would make a segment that matches
        // everyone while looking hand-picked. Stored as null instead.
        $criteria = array_filter(
            $validated['criteria'] ?? [],
            fn ($v) => $v !== null && $v !== '' && $v !== [],
        );

        $segment = CustomerSegment::create([
            'organization_id' => $orgId,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'criteria' => $criteria ?: null,
        ]);

        $segment->loadCount('members');

        if ($criteria) {
            $segment->members_count = $this->segments->matching($orgId, $criteria, reachableOnly: false)->count();
        }

        return (new OwnerSegmentResource($segment))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * DELETE /owner/segments/{id} — soft-delete an org-scoped segment
     * (404 if it belongs to another org).
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $segment = CustomerSegment::query()
            ->forOrganization($orgId)
            ->where('id', $id)
            ->firstOrFail();

        $segment->delete();

        return response()->json(null, 204);
    }
}
