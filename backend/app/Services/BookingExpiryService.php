<?php

namespace App\Services;

use App\Models\Booking;

/**
 * Releases the court slot held by an unpaid booking past its hold window.
 *
 * One place both callers share:
 *  - the scheduled `bookings:expire-unpaid` command sweeps every venue;
 *  - the customer bookings list sweeps that customer lazily, so a hold that has
 *    already timed out is never shown still marked "รอชำระเงิน" just because the
 *    scheduled run (or a missing cron) hasn't caught it yet.
 *
 * A booking whose slip is uploaded and awaiting review (a payment in
 * `pending_review`) is left alone — that customer has paid.
 */
class BookingExpiryService
{
    public function __construct(private NotificationService $notifications) {}

    /**
     * Cancel overdue pending_payment bookings and free their slots. Scope to one
     * customer for the lazy on-read sweep; omit to sweep everything (the cron).
     *
     * @return int how many were cancelled
     */
    public function sweep(?string $customerId = null): int
    {
        $cutoff = now()->subMinutes((int) config('booking.hold_minutes', 5));

        $expired = 0;

        Booking::query()
            ->where('status', 'pending_payment')
            ->where('created_at', '<=', $cutoff)
            ->when($customerId, fn ($q) => $q->where('customer_id', $customerId))
            // Leave alone anything the customer has already paid for and is just
            // waiting on the venue to approve.
            ->whereDoesntHave('payments', fn ($q) => $q->where('status', 'pending_review'))
            ->chunkById(200, function ($bookings) use (&$expired) {
                foreach ($bookings as $booking) {
                    $booking->update(['status' => 'cancelled']);
                    $this->notifications->bookingExpired($booking);
                    $expired++;
                }
            });

        return $expired;
    }
}
