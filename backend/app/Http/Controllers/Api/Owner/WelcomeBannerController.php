<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\WelcomeBannerResource;
use App\Models\WelcomeBanner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * The venue's welcome banners (CRUD, org-scoped).
 *
 * Every banner here belongs to the caller's own venue; anything else 404s
 * rather than leaking that it exists.
 */
class WelcomeBannerController extends Controller
{
    /** GET /owner/welcome-banners — all of them, off ones included. */
    public function index(Request $request): AnonymousResourceCollection
    {
        return WelcomeBannerResource::collection($this->scoped($request)->get());
    }

    /** POST /owner/welcome-banners — appended to the bottom of the list. */
    public function store(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $validated = $this->validated($request);

        $banner = WelcomeBanner::create([
            'organization_id' => $orgId,
            'title' => $validated['title'] ?? null,
            'message' => $validated['message'] ?? null,
            'image_url' => $validated['imageUrl'] ?? null,
            'link' => $validated['link'] ?? null,
            'is_active' => $validated['isActive'] ?? true,
            'popup' => $validated['popup'] ?? false,
            'sort_order' => (int) WelcomeBanner::query()->forOrganization($orgId)->max('sort_order') + 1,
        ]);

        return (new WelcomeBannerResource($banner))->response()->setStatusCode(201);
    }

    /** PUT /owner/welcome-banners/{id} */
    public function update(Request $request, string $id): WelcomeBannerResource
    {
        $banner = $this->find($request, $id);
        $validated = $this->validated($request);

        $columns = [
            'title' => 'title',
            'message' => 'message',
            'imageUrl' => 'image_url',
            'link' => 'link',
            'isActive' => 'is_active',
            'popup' => 'popup',
        ];

        $updates = [];
        foreach ($columns as $field => $column) {
            if (array_key_exists($field, $validated)) {
                $updates[$column] = $validated[$field];
            }
        }

        if ($updates) {
            $banner->update($updates);
        }

        return new WelcomeBannerResource($banner->fresh());
    }

    /**
     * POST /owner/welcome-banners/{id}/toggle — show or hide without deleting.
     *
     * The point of the whole feature: a seasonal banner gets parked, not
     * retyped next year.
     */
    public function toggle(Request $request, string $id): WelcomeBannerResource
    {
        $banner = $this->find($request, $id);
        $banner->update(['is_active' => ! $banner->is_active]);

        return new WelcomeBannerResource($banner->fresh());
    }

    /**
     * POST /owner/welcome-banners/reorder — { ids: [...] } top to bottom.
     *
     * Ids from another venue are ignored rather than rejected, so a stale tab
     * cannot reshuffle someone else's list.
     */
    public function reorder(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['string'],
        ]);

        $banners = $this->scoped($request)->get()->keyBy('id');

        foreach (array_values($validated['ids']) as $position => $id) {
            $banners->get($id)?->update(['sort_order' => $position]);
        }

        return WelcomeBannerResource::collection($this->scoped($request)->get());
    }

    /** DELETE /owner/welcome-banners/{id} */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->find($request, $id)->delete();

        return response()->json(null, 204);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'title' => ['sometimes', 'nullable', 'string', 'max:120'],
            'message' => ['sometimes', 'nullable', 'string', 'max:500'],
            'imageUrl' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'link' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'isActive' => ['sometimes', 'boolean'],
            'popup' => ['sometimes', 'boolean'],
        ]);
    }

    private function scoped(Request $request)
    {
        return WelcomeBanner::query()
            ->forOrganization($request->attributes->get('currentOrganizationId'))
            ->orderBy('sort_order')
            ->orderBy('created_at');
    }

    private function find(Request $request, string $id): WelcomeBanner
    {
        return $this->scoped($request)->where('id', $id)->firstOrFail();
    }
}
