<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Unpaid-booking hold window (minutes)
    |--------------------------------------------------------------------------
    |
    | A booking is created `pending_payment` and holds its court slot. If the
    | customer never pays, `bookings:expire-unpaid` (scheduled) cancels it after
    | this many minutes, freeing the slot for someone else. A booking whose slip
    | is already uploaded and awaiting review (payment status `pending_review`)
    | is NEVER expired — the customer paid; the venue just hasn't approved yet.
    |
    */

    'hold_minutes' => (int) env('BOOKING_HOLD_MINUTES', 30),

];
