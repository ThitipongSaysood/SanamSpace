<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Organization extends Model
{
    use HasUuids, SoftDeletes;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'trial_start_at' => 'datetime',
            'trial_end_at' => 'datetime',
        ];
    }

    public function settings(): HasOne
    {
        return $this->hasOne(OrganizationSetting::class);
    }

    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class);
    }

    public function courts(): HasMany
    {
        return $this->hasMany(Court::class);
    }

    public function customers(): HasMany
    {
        return $this->hasMany(Customer::class);
    }
}
