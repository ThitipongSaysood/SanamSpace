<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminPermissionResource;
use App\Http\Resources\AdminRoleResource;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;

/**
 * Roles and what each one may actually do.
 *
 * These used to be display-only — a role's permissions were counted on screen
 * and read by nothing. They are now enforced by the `permission:` middleware on
 * the owner routes, so a change here changes what that venue's staff can do.
 */
class RoleController extends Controller
{
    /** GET /admin/roles */
    public function index(): AnonymousResourceCollection
    {
        $roles = Role::query()
            ->with('permissions')
            ->withCount('permissions')
            ->orderByDesc('is_system_role')
            ->orderBy('name')
            ->get();

        return AdminRoleResource::collection($roles);
    }

    /** GET /admin/permissions — the catalogue; the client groups by module. */
    public function permissions(): AnonymousResourceCollection
    {
        $permissions = Permission::query()
            ->orderBy('module')
            ->orderBy('code')
            ->get();

        return AdminPermissionResource::collection($permissions);
    }

    /**
     * PUT /admin/roles/{id}/permissions — { permissionIds: [...] }
     *
     * Replaces the role's whole set, so unchecking is as meaningful as
     * checking.
     */
    public function updatePermissions(Request $request, string $id): AdminRoleResource
    {
        $role = Role::query()->findOrFail($id);

        // These two bypass the permission check by design — an editable list
        // would be a lie, and a tempting one to empty.
        if (in_array($role->code, ['owner', 'super_admin'], true)) {
            throw ValidationException::withMessages([
                'permissionIds' => 'บทบาทนี้มีสิทธิ์ทั้งหมดเสมอ แก้ไขไม่ได้',
            ]);
        }

        $validated = $request->validate([
            'permissionIds' => ['present', 'array'],
            'permissionIds.*' => ['string'],
        ]);

        // Unknown ids are dropped rather than rejected: a stale tab should not
        // fail the whole save over a permission that has since been removed.
        $ids = Permission::query()->whereIn('id', $validated['permissionIds'])->pluck('id')->all();

        $role->permissions()->sync($ids);

        return new AdminRoleResource($role->fresh(['permissions'])->loadCount('permissions'));
    }
}
