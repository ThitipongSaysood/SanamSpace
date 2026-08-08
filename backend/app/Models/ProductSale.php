<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** One receipt. Immutable once rung up — voiding adds a fact, it does not edit one. */
class ProductSale extends Model
{
    use HasUuids, BelongsToOrganization;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'total' => 'float',
            'sold_at' => 'datetime',
            'voided_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(ProductSaleItem::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sold_by');
    }

    public function isVoided(): bool
    {
        return $this->status === 'voided';
    }
}
