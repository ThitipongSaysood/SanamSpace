<?php

namespace App\Console\Commands;

use App\Services\BookingExpiryService;
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

    public function handle(BookingExpiryService $expiry): int
    {
        $expired = $expiry->sweep();

        $this->info("Expired {$expired} unpaid booking(s).");

        return self::SUCCESS;
    }
}
