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

// Points expiry is a daily question, not a per-minute one. Run it in the
// morning so a customer warned about expiry has the day to come and spend.
Schedule::command('points:expire')->dailyAt('09:00')->withoutOverlapping();

// Warn venues at 7, 3 and 1 days before their subscription lapses, and age
// unpaid invoices past their due date. Early enough in the day that whoever
// handles the money has office hours left to do something about it.
Schedule::command('subscriptions:remind-expiring')->dailyAt('08:00')->withoutOverlapping();
