<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Broadcast extends Model
{
    use HasUuids, SoftDeletes, BelongsToOrganization;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'recipient_count' => 'integer',
            'inactive_days' => 'integer',
            'sent_at' => 'datetime',
            'delivery_stats' => 'array',
        ];
    }

    public function segment(): BelongsTo
    {
        return $this->belongsTo(CustomerSegment::class, 'segment_id');
    }

    /** The staff member who pressed send. */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }

    /** Who this broadcast reached, one row per person. */
    public function recipients(): HasMany
    {
        return $this->hasMany(BroadcastRecipient::class);
    }
}
