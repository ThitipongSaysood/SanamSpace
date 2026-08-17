<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One line of a flash sale's reach: a whole branch, or a single court. */
class FlashSaleScope extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $guarded = [];

    public function flashSale(): BelongsTo
    {
        return $this->belongsTo(FlashSale::class);
    }
}
