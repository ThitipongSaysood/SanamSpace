<?php

namespace App\Models\Concerns;

use App\Models\Organization;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Marks a model as belonging to an organization (tenant).
 *
 * Scoping is intentionally not applied as a global scope yet: customer
 * browsing endpoints are cross-org reads. Callers that need tenant
 * isolation can use the `forOrganization` scope explicitly.
 */
trait BelongsToOrganization
{
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function scopeForOrganization($query, ?string $organizationId)
    {
        return $organizationId
            ? $query->where($this->getTable().'.organization_id', $organizationId)
            : $query;
    }
}
