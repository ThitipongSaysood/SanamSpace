<?php

namespace Tests;

use App\Support\VenueClock;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Carbon;

abstract class TestCase extends BaseTestCase
{
    /**
     * Pin the venue's wall clock to the middle of its own day.
     *
     * Four test classes were failing every night and passing every morning, all
     * for one reason. Bookings store the venue's wall clock as plain strings
     * (`date`, `start`, `end`), and these tests build them at an offset from
     * "now" — "starting in 90 minutes", "ends in an hour" — writing the row
     * straight to the table. Run after about 22:00, those offsets crossed
     * midnight and produced end="00:14" against today's date: a time EARLIER
     * than its own start. A booking the test meant as upcoming was then
     * correctly read as already finished, a court booked for later looked free,
     * and a customer could not be checked in to a slot that had apparently
     * ended.
     *
     * Nothing can create such a booking through the API — `end` is validated
     * `after:start` — so this is a fault in how the tests build data, not in
     * the product. Pinning to 13:00 leaves several hours either side, and keeps
     * today's date so the seeded subscription window still covers the requests.
     *
     * Call from `setUp()` AFTER seeding: it needs the organisation to know
     * which timezone "the venue" means.
     */
    protected function freezeVenueClockAtMidday(?string $organizationId = null): Carbon
    {
        $at = VenueClock::now($organizationId)->setTime(13, 0);

        Carbon::setTestNow($at);

        return $at;
    }
}
