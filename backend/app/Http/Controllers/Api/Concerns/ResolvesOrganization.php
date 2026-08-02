<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\Organization;
use Illuminate\Http\Request;

/**
 * Resolves the tenant (venue) for a customer-facing request.
 *
 * Every customer screen lives under /v/{slug}, and the app sends that slug on
 * every call as the X-Venue-Slug header, so the tenant is always knowable:
 *
 *  1. an explicit slug passed by the caller (route param / ?venueId=)
 *  2. the X-Venue-Slug header the customer app sends on every request
 *  3. ?venueId= / ?organizationSlug= on the query string
 *  4. the authenticated Customer's own organization
 *
 * There is deliberately NO "just use the first organization" fallback. Handing
 * one venue's catalogue to another venue's customer is a data leak, so an
 * unresolvable tenant is an error, not a default.
 */
trait ResolvesOrganization
{
    protected function resolveOrganization(Request $request, ?string $slug = null): ?Organization
    {
        $slug = $slug
            ?: $request->header('X-Venue-Slug')
            ?: $request->query('venueId')
            ?: $request->query('organizationSlug');

        $customerOrgId = $this->authenticatedCustomerOrganizationId($request);

        if ($slug) {
            $org = $this->organizationBySlugOrBranch($slug);

            // A customer belongs to exactly one venue and must never reach
            // another one's data by editing the slug in the URL.
            if ($org && $customerOrgId && $org->id !== $customerOrgId) {
                abort(403, 'This venue is not available for your account.');
            }

            return $org;
        }

        return $customerOrgId ? Organization::find($customerOrgId) : null;
    }

    /**
     * Same as resolveOrganization() but 404s instead of returning null, for the
     * endpoints that have no meaning without a venue.
     */
    protected function resolveOrganizationOrFail(Request $request, ?string $slug = null): Organization
    {
        $org = $this->resolveOrganization($request, $slug);

        abort_if($org === null, 404, 'Unknown venue. Open the app from your venue link.');

        return $org;
    }

    /**
     * The venue id the frontend uses is the organization slug; a branch UUID is
     * accepted too, since some routes are addressed by branch.
     */
    private function organizationBySlugOrBranch(string $slug): ?Organization
    {
        $org = Organization::where('slug', $slug)->first();

        if ($org) {
            return $org;
        }

        return Branch::where('id', $slug)->first()?->organization;
    }

    /**
     * The signed-in customer, if any. Uses the sanctum guard explicitly so this
     * also works on the public catalogue routes (which carry a Bearer token but
     * have no auth middleware to populate $request->user()).
     */
    private function authenticatedCustomerOrganizationId(Request $request): ?string
    {
        $user = $request->user() ?? $request->user('sanctum');

        return $user instanceof Customer ? $user->organization_id : null;
    }
}
