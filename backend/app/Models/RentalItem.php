<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Something the venue lends out and gets back.
 *
 * `stock_qty` is how many the venue OWNS. How many are free is a question about
 * a time window — see RentalService::availability.
 */
class RentalItem extends Model
{
    use HasUuids, SoftDeletes, BelongsToOrganization;

    public const UNITS = ['per_session', 'per_hour'];

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'price' => 'float',
            'stock_qty' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function scopeRentable(Builder $query): Builder
    {
        return $query->where('is_active', true)->orderBy('sort_order')->orderBy('name');
    }

    /** What one booking of `$hours` costs, before quantity. */
    public function priceFor(float $hours): float
    {
        return round($this->price_unit === 'per_hour' ? $this->price * $hours : $this->price, 2);
    }
}
