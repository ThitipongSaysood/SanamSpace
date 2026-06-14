<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Branch extends Model
{
    use HasUuids, SoftDeletes, BelongsToOrganization;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'sports' => 'array',
            'facilities' => 'array',
            'photos' => 'array',
            'week_hours' => 'array',
            'rating_breakdown' => 'array',
            'rating' => 'float',
            'distance_km' => 'float',
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    public function courts(): HasMany
    {
        return $this->hasMany(Court::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }
}
