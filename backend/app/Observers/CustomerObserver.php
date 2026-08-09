<?php

namespace App\Observers;

use App\Models\Customer;
use App\Services\TimelineRecorder;
use App\Support\ThaiPhone;

/** The first entry: the day they became a customer of this venue. */
class CustomerObserver
{
    public function __construct(private TimelineRecorder $timeline) {}

    /**
     * Keep the comparable copy of the phone in step with the typed one.
     *
     * Here rather than at each call site: a number set by the LINE login, by
     * staff, by an import or by a merge all have to end up matchable, and the
     * one that got missed would be the one that created the duplicate.
     */
    public function saving(Customer $customer): void
    {
        if ($customer->isDirty('phone')) {
            $customer->phone_normalized = ThaiPhone::normalize($customer->phone);
        }
    }

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
