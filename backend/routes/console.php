<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Release the court slot held by a booking nobody paid for, past its hold
// window (config('booking.hold_minutes')). Needs `php artisan schedule:run`
// wired to cron on the server (* * * * *) — see .agents deploy notes.
Schedule::command('bookings:expire-unpaid')->everyFiveMinutes()->withoutOverlapping();
