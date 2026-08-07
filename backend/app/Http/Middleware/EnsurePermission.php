<?php

namespace App\Http\Middleware;

use App\Models\OrganizationUser;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Enforces the staff member's role on an owner route: `permission:court.manage`.
 *
 * Roles and permissions were stored, counted, and displayed — and read by
 * nothing. A "Viewer" could verify payments and delete courts exactly like an
 * Owner. This is what turns the role picker in the staff screen into a real
 * choice.
 *
 * Two deliberate bypasses:
 *  - super admins, who support venues from the platform side;
 *  - the venue's own `owner` role, which must never be able to lock itself out
 *    of its own portal by editing a permission list.
 */
class EnsurePermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();

        if ($user?->is_super_admin) {
            return $next($request);
        }

        // Runs after owner.org, so the organization is already resolved.
        $membership = OrganizationUser::query()
            ->where('organization_id', $request->attributes->get('currentOrganizationId'))
            ->where('user_id', $user?->id)
            ->with('role.permissions')
            ->first();

        if (! $membership) {
            return $this->deny();
        }

        if ($membership->role?->code === 'owner') {
            return $next($request);
        }

        $allowed = $membership->role?->permissions->contains('code', $permission) ?? false;

        return $allowed ? $next($request) : $this->deny();
    }

    private function deny(): Response
    {
        return response()->json([
            'message' => 'บทบาทของคุณไม่มีสิทธิ์ใช้งานส่วนนี้',
            'code' => 'permission_denied',
        ], 403);
    }
}
