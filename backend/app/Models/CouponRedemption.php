<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One use of one coupon.
 *
 * Kept per redemption rather than as a counter, because "has this customer used
 * it" is the limit venues actually want and a total cannot answer it.
 */
class CouponRedemption extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['amount' => 'float'];
    }

    public function coupon(): BelongsTo
    {
        return $this->belongsTo(Coupon::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
