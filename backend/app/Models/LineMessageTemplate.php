<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * A venue's LINE Flex template for one booking event. `blocks` is the ordered
 * block tree the owner builds; the renderer turns it into LINE Flex JSON.
 * Absent row (or null blocks) → the code default for that event is used.
 */
class LineMessageTemplate extends Model
{
    use HasUuids, BelongsToOrganization;

    protected $guarded = [];

    protected $casts = [
        'enabled' => 'boolean',
        'blocks' => 'array',
    ];

    /** The events a template can be attached to. */
    public const EVENTS = ['booking_confirmed', 'payment_received', 'booking_cancelled'];
}
