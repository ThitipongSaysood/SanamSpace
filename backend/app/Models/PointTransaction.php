<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One movement of a customer's points.
 *
 * Signed, so the ledger can explain a balance going down as well as up. A row
 * with no `created_by` is one the system caused — earning from a booking is not
 * an action anyone has to answer for; a staff adjustment is.
 */
class PointTransaction extends Model
{
    use BelongsToOrganization, HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['points' => 'integer'];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    /** The staff member who made this adjustment. Null = the system did it. */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
