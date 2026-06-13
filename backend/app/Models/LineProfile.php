<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LineProfile extends Model
{
    use HasUuids;

    protected $guarded = [];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
