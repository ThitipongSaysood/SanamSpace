<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerRoleResource;
use App\Http\Resources\OwnerStaffResource;
use App\Models\OrganizationUser;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class StaffController extends Controller
{
    /**
     * GET /owner/staff — org members (organization_users joined to users + role).
     * Each item: { id(userId), displayName, email, roleName, status, joinedAt }
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $staff = OrganizationUser::query()
            ->forOrganization($orgId)
            ->with(['user', 'role'])
            ->orderBy('created_at')
            ->get();

        return OwnerStaffResource::collection($staff);
    }

    /**
     * GET /owner/roles — roles available to the current org: the shared system
     * roles (organization_id = null) plus any roles owned by this org.
     * Each item: { id, name, isSystemRole }
     */
    public function roles(Request $request): AnonymousResourceCollection
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $roles = Role::query()
            ->where(function ($q) use ($orgId) {
                $q->whereNull('organization_id')
                    ->orWhere('organization_id', $orgId);
            })
            ->orderByDesc('is_system_role')
            ->orderBy('name')
            ->get();

        return OwnerRoleResource::collection($roles);
    }
}
