<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/** One thing the counter sells — a bottle of water, a shuttlecock tube. */
class Product extends Model
{
    use HasUuids, SoftDeletes, BelongsToOrganization;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'price' => 'float',
            'stock_qty' => 'integer',
            'low_stock_threshold' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /** What the till may show, in the venue's own order. */
    public function scopeSellable(Builder $query): Builder
    {
        return $query->where('is_active', true)->orderBy('sort_order')->orderBy('name');
    }

    public function isOutOfStock(): bool
    {
        return $this->stock_qty <= 0;
    }

    /** Nearly out — a warning at the till, never a refusal. */
    public function isLowStock(): bool
    {
        return ! $this->isOutOfStock() && $this->stock_qty <= $this->low_stock_threshold;
    }
}
