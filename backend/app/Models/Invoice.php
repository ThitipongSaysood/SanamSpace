<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A platform billing document — what a venue pays to keep using SanamSpace.
 *
 * Raised either by the venue itself (source=owner, "ต่ออายุ") or by the
 * platform (source=admin). Either way the venue transfers the money and
 * uploads a slip; a Super Admin reviews it, and only then does the
 * subscription move — see App\Services\SubscriptionRenewalService.
 *
 * status: unpaid → pending_review → paid | rejected   (overdue = unpaid, past due)
 */
class Invoice extends Model
{
    use HasUuids, BelongsToOrganization;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'subtotal' => 'decimal:2',
            'vat_amount' => 'decimal:2',
            'vat_rate' => 'decimal:2',
            'period_months' => 'integer',
            'slip_uploaded_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    /** Awaiting a Super Admin's decision on an uploaded slip. */
    public function isAwaitingReview(): bool
    {
        return $this->status === 'pending_review';
    }

    /** Still owed: not paid yet, and not rejected. */
    public function isOutstanding(): bool
    {
        return in_array($this->status, ['unpaid', 'overdue', 'pending_review'], true);
    }
}
