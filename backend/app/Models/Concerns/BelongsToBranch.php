<?php

namespace App\Models\Concerns;

/**
 * A branch filter for models that carry `branch_id`.
 *
 * The owner portal is organization-scoped everywhere: a venue with three
 * branches saw one dashboard covering all three and one calendar with every
 * branch's courts side by side, with no way to look at a single branch. This is
 * the second half of that scope.
 *
 * A null branch id is "ทุกสาขา" and leaves the query alone — the combined view
 * is the default and must stay a plain org-wide query rather than a special
 * case each caller has to remember to write.
 *
 * Qualified with the table name for the same reason `forOrganization` is: these
 * queries join `courts` and `branches`, and an unqualified `branch_id` is
 * ambiguous the moment one of those joins is added.
 */
trait BelongsToBranch
{
    public function scopeForBranch($query, ?string $branchId)
    {
        return $branchId
            ? $query->where($this->getTable().'.branch_id', $branchId)
            : $query;
    }
}
