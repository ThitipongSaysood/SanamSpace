<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminRoleResource;
use App\Models\Role;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class RoleController extends Controller
{
    /**
     * GET /admin/roles — all roles (system + org-scoped) with permission counts.
     */
    public function index(): AnonymousResourceCollection
    {
        $roles = Role::query()
            ->withCount('permissions')
            ->orderByDesc('is_system_role')
            ->orderBy('name')
            ->get();

        return AdminRoleResource::collection($roles);
    }
}
