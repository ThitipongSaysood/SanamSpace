<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Promotion extends Model
{
    use HasUuids, SoftDeletes, BelongsToOrganization;

    protected $guarded = [];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /** The coupon this promotion applies when a customer taps it (optional). */
    public function coupon(): BelongsTo
    {
        return $this->belongsTo(Coupon::class);
    }
}
