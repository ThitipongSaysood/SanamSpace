<?php

namespace App\Observers;

use App\Models\Customer;
use App\Services\TimelineRecorder;

/** The first entry: the day they became a customer of this venue. */
class CustomerObserver
{
    public function __construct(private TimelineRecorder $timeline) {}

    public function created(Customer $customer): void
    {
        $this->timeline->record(
            $customer->organization_id,
            $customer->id,
            'signup',
            'สมัครสมาชิก',
            $customer->line_user_id ? 'เข้าสู่ระบบด้วย LINE' : 'สร้างโดยพนักงาน',
            $customer->created_at,
        );
    }
}
