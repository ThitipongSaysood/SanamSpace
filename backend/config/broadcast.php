<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Audience preset defaults
    |--------------------------------------------------------------------------
    |
    | Presets computed from booking history for the Owner "Broadcast" menu.
    |
    | - lost_inactive_days: a customer who booked before but whose most recent
    |   court date is older than this many days counts as "หายไป" (churned).
    | - new_within_days: a customer whose account is younger than this is "ใหม่".
    | - regular_min_bookings: this many non-cancelled bookings makes a "ลูกค้าประจำ".
    |
    | The lost/new day windows are per-broadcast overridable from the UI; these
    | are the defaults the form starts on.
    |
    */

    'lost_inactive_days' => (int) env('BROADCAST_LOST_INACTIVE_DAYS', 30),

    'new_within_days' => (int) env('BROADCAST_NEW_WITHIN_DAYS', 30),

    'regular_min_bookings' => (int) env('BROADCAST_REGULAR_MIN_BOOKINGS', 5),

];
