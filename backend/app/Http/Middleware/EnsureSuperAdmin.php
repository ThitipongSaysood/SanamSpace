<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gates the Super Admin (platform) API.
 *
 * The authenticated principal MUST be a User (an admin account, not a
 * customer) AND have is_super_admin === true. Anyone else — customers,
 * org owners/staff, orphan users — is rejected with 403.
 *
 * Platform-level: no organization scoping is applied here; super admins
 * operate across ALL organizations.
 */
class EnsureSuperAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User || $user->is_super_admin !== true) {
            abort(403, 'Super admin access required.');
        }

        return $next($request);
    }
}
