<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerPromotionResource;
use App\Models\Promotion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class PromotionController extends Controller
{
    /**
     * GET /owner/promotions — org promotions ordered by sort_order.
     * Each item: { id, title, subtitle, tag, sortOrder }
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $promotions = Promotion::query()
            ->forOrganization($orgId)
            ->with('coupon')
            ->orderBy('sort_order')
            ->orderBy('created_at')
            ->get();

        return OwnerPromotionResource::collection($promotions);
    }

    /**
     * POST /owner/promotions — create a promotion in the current org.
     * New promotions are appended (sort_order = current max + 1).
     */
    public function store(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'subtitle' => ['nullable', 'string', 'max:255'],
            'tag' => ['required', 'string', 'max:255'],
            // Optional link to one of this venue's own coupons.
            'couponId' => ['sometimes', 'nullable', 'string', Rule::exists('coupons', 'id')->where('organization_id', $orgId)],
            'isActive' => ['sometimes', 'boolean'],
        ]);

        $nextSort = (int) Promotion::query()
            ->forOrganization($orgId)
            ->max('sort_order') + 1;

        $promotion = Promotion::create([
            'organization_id' => $orgId,
            'title' => $validated['title'],
            'subtitle' => $validated['subtitle'] ?? null,
            'tag' => $validated['tag'],
            'coupon_id' => $validated['couponId'] ?? null,
            'is_active' => $validated['isActive'] ?? true,
            'sort_order' => $nextSort,
        ]);

        return (new OwnerPromotionResource($promotion->load('coupon')))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * PUT /owner/promotions/{id} — update an org-scoped promotion (404 if
     * it belongs to another org).
     */
    public function update(Request $request, string $id): OwnerPromotionResource
    {
        $promotion = $this->findScoped($request, $id);

        $orgId = $request->attributes->get('currentOrganizationId');

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'subtitle' => ['sometimes', 'nullable', 'string', 'max:255'],
            'tag' => ['sometimes', 'required', 'string', 'max:255'],
            'couponId' => ['sometimes', 'nullable', 'string', Rule::exists('coupons', 'id')->where('organization_id', $orgId)],
            'isActive' => ['sometimes', 'boolean'],
            'sortOrder' => ['sometimes', 'integer', 'min:0'],
        ]);

        $updates = [];
        foreach (['title', 'subtitle', 'tag'] as $field) {
            if (array_key_exists($field, $validated)) {
                $updates[$field] = $validated[$field];
            }
        }
        if (array_key_exists('couponId', $validated)) {
            $updates['coupon_id'] = $validated['couponId'];
        }
        if (array_key_exists('isActive', $validated)) {
            $updates['is_active'] = $validated['isActive'];
        }
        if (array_key_exists('sortOrder', $validated)) {
            $updates['sort_order'] = $validated['sortOrder'];
        }

        if ($updates) {
            $promotion->update($updates);
        }

        return new OwnerPromotionResource($promotion->fresh()->load('coupon'));
    }

    /**
     * DELETE /owner/promotions/{id} — soft-delete an org-scoped promotion.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $promotion = $this->findScoped($request, $id);
        $promotion->delete();

        return response()->json(null, 204);
    }

    /**
     * Fetch a promotion within the current org or abort (404).
     */
    private function findScoped(Request $request, string $id): Promotion
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        return Promotion::query()
            ->forOrganization($orgId)
            ->where('id', $id)
            ->firstOrFail();
    }
}
