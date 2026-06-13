<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * Pivot for the plans <-> features relationship. Carries its own UUID
 * primary key (the table has a uuid `id`), so attaches/syncs generate one.
 */
class PlanFeature extends Pivot
{
    use HasUuids;

    protected $table = 'plan_features';

    public $incrementing = false;

    protected $keyType = 'string';
}
