<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerBranchResource;
use App\Models\Branch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * Owner Portal — manage branches (สนาม/สาขา) within the current organization.
 * Org-scoped via the owner.org middleware + forOrganization.
 */
class BranchController extends Controller
{
    /**
     * GET /owner/branches — branches for the current org (+ court count).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $branches = Branch::query()
            ->forOrganization($orgId)
            ->withCount('courts')
            ->orderBy('created_at')
            ->get();

        return OwnerBranchResource::collection($branches);
    }

    /**
     * POST /owner/branches — create a branch in the current org.
     */
    public function store(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $validated = $this->validatePayload($request, creating: true);

        $branch = Branch::create(array_merge(
            $this->mapFields($validated),
            [
                'organization_id' => $orgId,
                'status' => $validated['status'] ?? 'active',
            ],
        ));

        $branch->loadCount('courts');

        return (new OwnerBranchResource($branch))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * PUT /owner/branches/{id} — partial update of an org-scoped branch.
     */
    public function update(Request $request, string $id): OwnerBranchResource
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $branch = $this->findScoped($orgId, $id);

        $validated = $this->validatePayload($request, creating: false);
        $updates = $this->mapFields($validated);
        if (array_key_exists('status', $validated)) {
            $updates['status'] = $validated['status'];
        }

        if ($updates) {
            $branch->update($updates);
        }

        return new OwnerBranchResource($branch->fresh()->loadCount('courts'));
    }

    /**
     * POST /owner/branches/{id}/toggle — flip status active <-> inactive (เปิด/ปิด).
     */
    public function toggle(Request $request, string $id): OwnerBranchResource
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $branch = $this->findScoped($orgId, $id);

        $branch->update(['status' => $branch->status === 'active' ? 'inactive' : 'active']);

        return new OwnerBranchResource($branch->fresh()->loadCount('courts'));
    }

    /**
     * DELETE /owner/branches/{id} — soft-delete an org-scoped branch.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $this->findScoped($orgId, $id)->delete();

        return response()->json(null, 204);
    }

    private function validatePayload(Request $request, bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'name' => [$required, 'string', 'max:255'],
            'address' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'openTime' => ['sometimes', 'nullable', 'date_format:H:i'],
            'closeTime' => ['sometimes', 'nullable', 'date_format:H:i'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'sports' => ['sometimes', 'array'],
            'sports.*' => ['string', 'max:50'],
            'facilities' => ['sometimes', 'array'],
            'facilities.*' => ['string', 'max:100'],
            'imageUrl' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
        ]);
    }

    private function mapFields(array $validated): array
    {
        $out = [];
        foreach (['name', 'address', 'phone', 'sports', 'facilities', 'description'] as $f) {
            if (array_key_exists($f, $validated)) {
                $out[$f] = $validated[$f];
            }
        }
        if (array_key_exists('openTime', $validated)) {
            $out['open_time'] = $validated['openTime'];
        }
        if (array_key_exists('closeTime', $validated)) {
            $out['close_time'] = $validated['closeTime'];
        }
        if (array_key_exists('imageUrl', $validated)) {
            $out['image_url'] = $validated['imageUrl'];
        }

        return $out;
    }

    private function findScoped(?string $orgId, string $id): Branch
    {
        return Branch::query()
            ->forOrganization($orgId)
            ->where('id', $id)
            ->firstOrFail();
    }
}
