<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class CustomerPackage extends Model
{
    use HasUuids, SoftDeletes, BelongsToOrganization;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'total_hours' => 'float',
            'remaining_hours' => 'float',
            'price' => 'float',
            'valid_days' => 'integer',
            'expires_at' => 'date',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function venuePackage(): BelongsTo
    {
        return $this->belongsTo(VenuePackage::class);
    }

    /** Active, not expired, and has hours left. */
    public function isUsable(): bool
    {
        return $this->status === 'active'
            && $this->remaining_hours > 0
            && (! $this->expires_at || ! $this->expires_at->isPast());
    }
}
