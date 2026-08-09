<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Something points can be spent on. */
class Reward extends Model
{
    use BelongsToOrganization, HasUuids, SoftDeletes;

    public const TYPES = ['product', 'credit', 'hours'];

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'points_cost' => 'integer',
            'credit_amount' => 'float',
            'hours' => 'float',
            'is_active' => 'boolean',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
