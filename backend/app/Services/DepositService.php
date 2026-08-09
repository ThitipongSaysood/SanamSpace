<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\OrganizationSetting;

/**
 * How much has to be paid now, and how much is left.
 *
 * A venue that takes deposits holds the court for part of the money and
 * collects the rest at the counter. Everything else in the system already
 * treats `amount` as the grand total, so deposits are expressed as "how much of
 * that is due up front" rather than as a second kind of price.
 */
class DepositService
{
    /**
     * The deposit for a booking of this size, snapshotted at booking time.
     *
     * Never more than the booking itself: a ฿200 fixed deposit on a ฿150 court
     * would ask for more than the whole thing.
     */
    public function depositFor(?OrganizationSetting $settings, float $amount): float
    {
        if (! $settings?->deposit_enabled || $amount <= 0) {
            return 0.0;
        }

        $value = (float) $settings->deposit_value;

        $deposit = $settings->deposit_type === 'fixed'
            ? $value
            : round($amount * ($value / 100), 2);

        // A deposit of zero means "no deposit", and one at or above the full
        // amount is just paying in full — both are the same thing to the rest
        // of the flow, so neither is stored as a deposit.
        if ($deposit <= 0 || $deposit >= $amount) {
            return 0.0;
        }

        return round($deposit, 2);
    }

    /** What the customer still owes on this booking. */
    public function outstanding(Booking $booking): float
    {
        return max(0, round((float) $booking->amount - (float) $booking->paid_amount, 2));
    }

    /**
     * What the next payment should ask for.
     *
     * The deposit while nothing has been paid, the remaining balance after
     * that. Asking for the full amount up front would make the deposit setting
     * decorative; asking for the deposit twice would undercharge.
     */
    public function nextPaymentAmount(Booking $booking): float
    {
        $outstanding = $this->outstanding($booking);
        $deposit = (float) ($booking->deposit_amount ?? 0);

        if ($deposit > 0 && (float) $booking->paid_amount <= 0) {
            return min($deposit, $outstanding);
        }

        return $outstanding;
    }

    /**
     * Record money received, and decide what the booking now is.
     *
     * Confirmed once the deposit is covered — that is the whole point of a
     * deposit, the slot is held. A booking with a balance left stays confirmed
     * and carries the outstanding figure; it does not go back to
     * pending_payment, which would read to the customer as "we lost your money".
     */
    public function applyPayment(Booking $booking, float $amount): void
    {
        $this->creditPayment($booking, $amount);

        // Points hang off here rather than off each caller: slip approval, the
        // counter settle, a credit payment and a package redemption all end up
        // in this method, and one of them would eventually forget.
        app(PointsService::class)->awardForBooking($booking->fresh());
    }

    private function creditPayment(Booking $booking, float $amount): void
    {
        $paid = round((float) $booking->paid_amount + $amount, 2);

        $updates = ['paid_amount' => $paid];

        if ($booking->status !== 'completed') {
            $threshold = (float) ($booking->deposit_amount ?: $booking->amount);
            $updates['status'] = $paid + 0.001 >= $threshold ? 'confirmed' : 'pending_payment';
        }

        $booking->update($updates);
    }
}
