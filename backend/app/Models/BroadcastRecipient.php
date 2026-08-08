<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One person, one broadcast, one outcome.
 *
 * `skipped` and `failed` are kept apart on purpose: the first means the venue
 * cannot reach them, the second means something is broken. Rolling both into
 * "not sent" is how a broken LINE token goes unnoticed for a week.
 */
class BroadcastRecipient extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['sent_at' => 'datetime'];
    }

    public function broadcast(): BelongsTo
    {
        return $this->belongsTo(Broadcast::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
