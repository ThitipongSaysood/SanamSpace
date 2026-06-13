<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Support\CurrentOrganization;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves the current organization for an Owner Portal request from the
 * authenticated User's organization_users membership and stashes the org id
 * on the request as `currentOrganizationId`.
 *
 * Owner endpoints are staff-only: the authenticated user MUST be an admin
 * User (not a customer) AND belong to at least one organization. Otherwise
 * the request is rejected with 403. The first/only membership is used for now.
 */
class ResolveOwnerOrganization
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            abort(403, 'Owner portal requires a staff account.');
        }

        $membership = $user->organizationUsers()->with('organization')->first();

        if (! $membership || ! $membership->organization) {
            abort(403, 'You are not a staff member of any organization.');
        }

        // Make the org resolvable everywhere (resources, etc.) for this request.
        CurrentOrganization::set($membership->organization);
        $request->attributes->set('currentOrganizationId', $membership->organization_id);

        return $next($request);
    }
}
