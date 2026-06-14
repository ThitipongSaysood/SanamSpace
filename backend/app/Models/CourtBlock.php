<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CourtBlock extends Model
{
    use HasUuids, BelongsToOrganization;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['date' => 'date'];
    }

    public function court(): BelongsTo
    {
        return $this->belongsTo(Court::class);
    }

    /**
     * Does this block cover the given time range on its date?
     * A whole-day block (no start/end) covers everything.
     */
    public function covers(string $start, string $end): bool
    {
        if (! $this->start || ! $this->end) {
            return true;
        }

        return $this->start < $end && $this->end > $start;
    }
}
