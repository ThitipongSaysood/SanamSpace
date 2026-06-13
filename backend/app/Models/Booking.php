<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Booking extends Model
{
    use HasUuids, SoftDeletes, BelongsToOrganization;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            // `date` is intentionally NOT cast to a date object: it is stored
            // and surfaced as a plain "Y-m-d" string to match the frontend
            // Booking shape and to keep slot-overlap comparisons exact.
            'amount' => 'float',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function court(): BelongsTo
    {
        return $this->belongsTo(Court::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
