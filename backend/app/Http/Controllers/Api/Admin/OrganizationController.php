<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminOrganizationDetailResource;
use App\Http\Resources\AdminOrganizationResource;
use App\Models\Organization;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OrganizationController extends Controller
{
    /**
     * GET /admin/organizations — ALL organizations (platform-level, no scoping).
     */
    public function index(): AnonymousResourceCollection
    {
        $organizations = Organization::query()
            ->with('activeSubscription.plan')
            ->withCount(['branches', 'courts', 'customers'])
            ->orderBy('created_at')
            ->get();

        return AdminOrganizationResource::collection($organizations);
    }

    /**
     * GET /admin/organizations/{id} — single org detail (id = slug or uuid).
     */
    public function show(string $id): AdminOrganizationDetailResource
    {
        $organization = Organization::query()
            ->with(['activeSubscription.plan', 'settings'])
            ->withCount(['branches', 'courts', 'customers'])
            ->where('slug', $id)
            ->orWhere('id', $id)
            ->firstOrFail();

        return new AdminOrganizationDetailResource($organization);
    }
}
