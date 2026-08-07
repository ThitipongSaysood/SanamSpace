<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A help request from a venue.
 *
 * status: open | pending | resolved | closed — `resolved_at` is stamped the
 * first time it leaves the open states, so "how long did we take" stays
 * answerable even if someone reopens it later.
 */
class SupportTicket extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['resolved_at' => 'datetime'];
    }

    public function replies(): HasMany
    {
        return $this->hasMany(SupportTicketReply::class)->orderBy('created_at');
    }

    /** Still needs someone from the platform to act on it. */
    public function isOpen(): bool
    {
        return ! in_array($this->status, ['resolved', 'closed'], true);
    }
}
