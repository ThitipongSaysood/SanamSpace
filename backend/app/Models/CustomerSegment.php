<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class CustomerSegment extends Model
{
    use HasUuids, SoftDeletes, BelongsToOrganization;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'criteria' => 'array',
        ];
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(Customer::class, 'customer_segment_members', 'segment_id', 'customer_id')
            ->using(CustomerSegmentMember::class)
            ->withTimestamps();
    }

    public function broadcasts(): HasMany
    {
        return $this->hasMany(Broadcast::class, 'segment_id');
    }
}
