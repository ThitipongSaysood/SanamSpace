<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One message in a support thread — from the platform, or from the venue.
 *
 * `emailed` records whether the venue was actually reached: a reply that only
 * lives in the admin portal has not answered anybody.
 */
class SupportTicketReply extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['emailed' => 'boolean'];
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(SupportTicket::class, 'support_ticket_id');
    }
}
