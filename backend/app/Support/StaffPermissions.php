<?php

namespace App\Support;

use App\Models\OrganizationUser;
use Illuminate\Http\Request;

/**
 * "May this staff member do X here?"
 *
 * Lives apart from the middleware because one endpoint — the counter's
 * scanner — decides what it is doing only after it reads the code, so it has to
 * ask the same question mid-request that `permission:` asks on the route. Two
 * copies of this rule would drift, and the copy that drifted would be the one
 * granting the extra power.
 */
class StaffPermissions
{
    public static function allows(Request $request, string $permission): bool
    {
        $user = $request->user();

        // Super admins support venues from the platform side.
        if ($user?->is_super_admin) {
            return true;
        }

        $membership = OrganizationUser::query()
            ->where('organization_id', $request->attributes->get('currentOrganizationId'))
            ->where('user_id', $user?->id)
            ->with('role.permissions')
            ->first();

        if (! $membership) {
            return false;
        }

        // The venue's owner can never be locked out of its own portal.
        if ($membership->role?->code === 'owner') {
            return true;
        }

        return $membership->role?->permissions->contains('code', $permission) ?? false;
    }
}
