<?php

namespace App\Observers;

use App\Models\Booking;
use App\Services\TimelineRecorder;

/**
 * A booking's life, as the CRM sees it.
 *
 * Only the moments a human would call events: booked, cancelled, arrived.
 * `updated` fires for every column change — repricing a booking is not a story
 * anyone wants in a customer's history — so each branch checks that the field
 * it cares about is the one that moved.
 */
class BookingObserver
{
    public function __construct(private TimelineRecorder $timeline) {}

    public function created(Booking $booking): void
    {
        $this->timeline->record(
            $booking->organization_id,
            $booking->customer_id,
            'booking',
            "จอง {$booking->code}",
            trim("{$booking->date} {$booking->start}-{$booking->end}"),
            $booking->created_at,
        );
    }

    public function updated(Booking $booking): void
    {
        if ($booking->wasChanged('status') && $booking->status === 'cancelled') {
            $this->timeline->record(
                $booking->organization_id,
                $booking->customer_id,
                'booking',
                "ยกเลิกการจอง {$booking->code}",
                "{$booking->date} {$booking->start}-{$booking->end}",
            );
        }

        // Arriving is the moment the venue actually met them, which is what a
        // "last seen" question is really asking.
        if ($booking->wasChanged('checked_in_at') && $booking->checked_in_at) {
            $this->timeline->record(
                $booking->organization_id,
                $booking->customer_id,
                'booking',
                "เช็คอิน {$booking->code}",
                $booking->court?->name,
                $booking->checked_in_at,
            );
        }
    }
}
