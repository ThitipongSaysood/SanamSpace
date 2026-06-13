<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A single entry in a customer's activity timeline (CRM). Backed by the
 * `customer_timeline` table. type is one of signup|booking|payment|points|note.
 */
class CustomerTimelineEntry extends Model
{
    use HasUuids, BelongsToOrganization;

    protected $table = 'customer_timeline';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'occurred_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
