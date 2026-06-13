<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\Customer;
use App\Models\Organization;
use Illuminate\Http\Request;

/**
 * Shared organization resolution for customer-facing endpoints.
 *
 * Resolution order:
 *  1. an explicit slug (e.g. ?venueId= / ?organizationSlug=), if it matches
 *  2. the authenticated Customer's organization (when called under auth:sanctum)
 *  3. the oldest organization (sensible default for single-tenant dev)
 */
trait ResolvesOrganization
{
    protected function resolveOrganization(Request $request, ?string $slug = null): ?Organization
    {
        if ($slug) {
            $org = Organization::where('slug', $slug)->first();
            if ($org) {
                return $org;
            }
        }

        $user = $request->user();
        if ($user instanceof Customer && $user->organization_id) {
            return Organization::find($user->organization_id);
        }

        return Organization::query()->orderBy('created_at')->first();
    }
}
