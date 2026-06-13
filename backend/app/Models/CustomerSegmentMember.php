<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * Pivot for customer_segments <-> customers. Carries its own UUID primary key
 * (the table has a uuid `id`), so attaches/syncs generate one — same pattern
 * as PlanFeature.
 */
class CustomerSegmentMember extends Pivot
{
    use HasUuids;

    protected $table = 'customer_segment_members';

    public $incrementing = false;

    protected $keyType = 'string';
}
