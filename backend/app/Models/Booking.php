<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Booking extends Model
{
    use HasUuids, SoftDeletes, BelongsToOrganization;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            // `date` is intentionally NOT cast to a date object: it is stored
            // and surfaced as a plain "Y-m-d" string to match the frontend
            // Booking shape and to keep slot-overlap comparisons exact.
            'amount' => 'float',
            'court_amount' => 'float',
            'rental_total' => 'float',
            'checked_in_at' => 'datetime',
            'package_redeemed_at' => 'datetime',
            'package_hours_used' => 'float',
            'discount_amount' => 'float',
            'deposit_amount' => 'float',
            'paid_amount' => 'float',
        ];
    }

    /**
     * Every booking gets a check-in token, whoever created it — the counter's
     * scanner, the seeder, a test. Doing this in one controller would leave the
     * other paths with a QR screen that has nothing to draw.
     */
    protected static function booted(): void
    {
        static::creating(function (Booking $booking) {
            $booking->checkin_token ??= \App\Services\CheckinService::newToken();
        });
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function court(): BelongsTo
    {
        return $this->belongsTo(Court::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function rentals(): HasMany
    {
        return $this->hasMany(BookingRental::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * The payment that decides what the customer is asked to do next.
     *
     * Newest wins: a rejected slip followed by a fresh attempt should read as
     * "under review", not as "rejected".
     */
    public function latestPayment(): HasOne
    {
        return $this->hasOne(Payment::class)->latestOfMany();
    }

    /**
     * Close any payment still waiting on someone, because this booking is over.
     *
     * Called when a booking is cancelled or deleted. Without it the slip stays
     * in the venue's ตรวจสลิป queue forever — and approving it there used to
     * flip the cancelled booking back to confirmed.
     *
     * Approved payments are left alone: that is money actually received, and it
     * leaves through a refund, not by rewriting the payment.
     */
    public function closeOutstandingPayments(): void
    {
        $this->payments()
            ->whereIn('status', ['awaiting_slip', 'pending_review'])
            ->update(['status' => 'cancelled']);
    }

    /** The credit package that paid for this booking's court time, if any. */
    public function customerPackage(): BelongsTo
    {
        return $this->belongsTo(CustomerPackage::class, 'customer_package_id');
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class);
    }
}
