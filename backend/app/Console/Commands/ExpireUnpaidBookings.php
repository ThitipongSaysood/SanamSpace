<?php

namespace App\Console\Commands;

use App\Models\Booking;
use App\Services\NotificationService;
use Illuminate\Console\Command;

/**
 * Releases the court slot held by a booking nobody paid for.
 *
 * A booking is created `pending_payment` and its slot counts as taken (the
 * overlap check excludes only `cancelled`). Without this, an abandoned booking
 * would hold a prime-time slot forever. Run on a schedule (see
 * routes/console.php); the hold window is config('booking.hold_minutes').
 *
 * A booking whose slip is uploaded and awaiting the venue's review
 * (a payment in `pending_review`) is left alone — that customer has paid.
 */
class ExpireUnpaidBookings extends Command
{
    protected $signature = 'bookings:expire-unpaid';

    protected $description = 'Cancel pending_payment bookings past their hold window and free the slot';

    public function handle(NotificationService $notifications): int
    {
        $cutoff = now()->subMinutes((int) config('booking.hold_minutes', 30));

        $expired = 0;

        Booking::query()
            ->where('status', 'pending_payment')
            ->where('created_at', '<=', $cutoff)
            // Leave alone anything the customer has already paid for and is
            // just waiting on the venue to approve.
            ->whereDoesntHave('payments', fn ($q) => $q->where('status', 'pending_review'))
            ->chunkById(200, function ($bookings) use (&$expired, $notifications) {
                foreach ($bookings as $booking) {
                    $booking->update(['status' => 'cancelled']);
                    $notifications->bookingExpired($booking);
                    $expired++;
                }
            });

        $this->info("Expired {$expired} unpaid booking(s).");

        return self::SUCCESS;
    }
}
