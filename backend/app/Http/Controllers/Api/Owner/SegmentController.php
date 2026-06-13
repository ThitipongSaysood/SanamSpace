<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerSegmentResource;
use App\Models\CustomerSegment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SegmentController extends Controller
{
    /**
     * GET /owner/segments — org customer segments with member counts.
     * Each item: { id, name, description, memberCount }
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $segments = CustomerSegment::query()
            ->forOrganization($orgId)
            ->withCount('members')
            ->orderBy('created_at')
            ->get();

        return OwnerSegmentResource::collection($segments);
    }

    /**
     * POST /owner/segments — create a segment in the current org.
     */
    public function store(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
        ]);

        $segment = CustomerSegment::create([
            'organization_id' => $orgId,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
        ]);

        $segment->loadCount('members');

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
