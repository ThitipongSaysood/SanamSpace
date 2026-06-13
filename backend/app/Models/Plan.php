<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Plan extends Model
{
    use HasUuids, SoftDeletes;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'price' => 'float',
            'branch_limit' => 'integer',
            'court_limit' => 'integer',
            'staff_limit' => 'integer',
            'monthly_booking_limit' => 'integer',
            'storage_gb' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function features(): BelongsToMany
    {
        return $this->belongsToMany(Feature::class, 'plan_features')
            ->using(PlanFeature::class)
            ->withPivot('enabled')
            ->withTimestamps();
    }

    /** Features explicitly enabled (pivot.enabled = 1) for this plan. */
    public function enabledFeatures(): BelongsToMany
    {
        return $this->features()->wherePivot('enabled', 1);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }
}
