<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One rental line on a booking.
 *
 * Name, price and unit are snapshots — a later reprice must not change what the
 * customer was quoted and paid.
 */
class BookingRental extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'unit_price' => 'float',
            'hours' => 'float',
            'line_total' => 'float',
            'quantity' => 'integer',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(RentalItem::class, 'rental_item_id');
    }
}
