<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerCourtResource;
use App\Models\Court;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * Owner Portal — manage courts (คอร์ท) within the current organization.
 * All operations are org-scoped via the owner.org middleware + forOrganization.
 */
class CourtController extends Controller
{
    private const SPEC_FIELDS = ['floor', 'aircon', 'height', 'lighting', 'standard', 'players'];

    /**
     * GET /owner/courts — courts for the current org (management shape).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $courts = Court::query()
            ->forOrganization($orgId)
            ->with('branch')
            ->orderBy('sort_order')
            ->orderBy('created_at')
            ->get();

        return OwnerCourtResource::collection($courts);
    }

    /**
     * POST /owner/courts — create a court under one of the org's branches.
     */
    public function store(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $validated = $this->validatePayload($request, $orgId, creating: true);

        $nextSort = (int) Court::query()->forOrganization($orgId)->max('sort_order') + 1;

        $court = Court::create(array_merge(
            $this->mapFields($validated),
            [
                'organization_id' => $orgId,
                'sort_order' => $nextSort,
                'status' => $validated['status'] ?? 'active',
            ],
        ));

        return (new OwnerCourtResource($court->load('branch')))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * PUT /owner/courts/{id} — partial update of an org-scoped court.
     */
    public function update(Request $request, string $id): OwnerCourtResource
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $court = $this->findScoped($orgId, $id);

        $validated = $this->validatePayload($request, $orgId, creating: false);
        $updates = $this->mapFields($validated);
        if (array_key_exists('status', $validated)) {
            $updates['status'] = $validated['status'];
        }

        if ($updates) {
            $court->update($updates);
        }

        return new OwnerCourtResource($court->fresh()->load('branch'));
    }

    /**
     * POST /owner/courts/{id}/toggle — flip status active <-> inactive (เปิด/ปิด).
     */
    public function toggle(Request $request, string $id): OwnerCourtResource
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $court = $this->findScoped($orgId, $id);

        $court->update(['status' => $court->status === 'active' ? 'inactive' : 'active']);

        return new OwnerCourtResource($court->fresh()->load('branch'));
    }

    /**
     * DELETE /owner/courts/{id} — soft-delete an org-scoped court.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $this->findScoped($orgId, $id)->delete();

        return response()->json(null, 204);
    }

    /**
     * Validate the request. `branchId` must belong to the current org.
     */
    private function validatePayload(Request $request, ?string $orgId, bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'branchId' => [
                $required,
                'string',
                Rule::exists('branches', 'id')->where('organization_id', $orgId),
            ],
            'name' => [$required, 'string', 'max:255'],
            'sport' => [$required, 'string', 'max:50'],
            'pricePerHour' => [$creating ? 'required' : 'sometimes', 'numeric', 'min:0'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'imageUrl' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'floor' => ['sometimes', 'nullable', 'string', 'max:255'],
            'aircon' => ['sometimes', 'nullable', 'string', 'max:255'],
            'height' => ['sometimes', 'nullable', 'string', 'max:255'],
            'lighting' => ['sometimes', 'nullable', 'string', 'max:255'],
            'standard' => ['sometimes', 'nullable', 'string', 'max:255'],
            'players' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);
    }

    /**
     * Translate validated camelCase input into DB columns (only present keys).
     */
    private function mapFields(array $validated): array
    {
        $out = [];
        if (array_key_exists('branchId', $validated)) {
            $out['branch_id'] = $validated['branchId'];
        }
        foreach (['name', 'sport'] as $f) {
            if (array_key_exists($f, $validated)) {
                $out[$f] = $validated[$f];
            }
        }
        if (array_key_exists('pricePerHour', $validated)) {
            $out['price_per_hour'] = $validated['pricePerHour'];
        }
        if (array_key_exists('imageUrl', $validated)) {
            $out['image_url'] = $validated['imageUrl'];
        }
        foreach (self::SPEC_FIELDS as $f) {
            if (array_key_exists($f, $validated)) {
                $out[$f] = $validated[$f];
            }
        }

        return $out;
    }

    private function findScoped(?string $orgId, string $id): Court
    {
        return Court::query()
            ->forOrganization($orgId)
            ->where('id', $id)
            ->firstOrFail();
    }
}
