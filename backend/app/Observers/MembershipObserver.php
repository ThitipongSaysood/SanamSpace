<?php

namespace App\Observers;

use App\Models\Membership;
use App\Services\TimelineRecorder;

/** Points moving, and tiers changing — both things a customer notices. */
class MembershipObserver
{
    public function __construct(private TimelineRecorder $timeline) {}

    public function updated(Membership $membership): void
    {
        if ($membership->wasChanged('points')) {
            $before = (int) $membership->getOriginal('points');
            $delta = (int) $membership->points - $before;

            if ($delta !== 0) {
                $sign = $delta > 0 ? '+' : '';
                $this->timeline->record(
                    $membership->organization_id,
                    $membership->customer_id,
                    'points',
                    "แต้มสะสม {$sign}{$delta}",
                    "คงเหลือ {$membership->points} แต้ม",
                );
            }
        }

        if ($membership->wasChanged('tier')) {
            $this->timeline->record(
                $membership->organization_id,
                $membership->customer_id,
                'points',
                "เลื่อนระดับเป็น {$membership->tier}",
            );
        }
    }
}
