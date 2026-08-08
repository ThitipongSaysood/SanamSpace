<?php

namespace App\Observers;

use App\Models\Payment;
use App\Services\TimelineRecorder;

/**
 * Money in, and money refused.
 *
 * Only decided payments are worth a line: a payment row is created the moment
 * someone taps "pay", which is not yet a fact about the customer.
 */
class PaymentObserver
{
    public function __construct(private TimelineRecorder $timeline) {}

    public function updated(Payment $payment): void
    {
        if (! $payment->wasChanged('status')) {
            return;
        }

        $amount = number_format((float) $payment->amount, 0);

        match ($payment->status) {
            'approved' => $this->timeline->record(
                $payment->organization_id,
                $payment->customer_id,
                'payment',
                "ชำระเงิน ฿{$amount}",
                $payment->method === 'promptpay' ? 'PromptPay' : 'โอนเงิน',
            ),
            'rejected' => $this->timeline->record(
                $payment->organization_id,
                $payment->customer_id,
                'payment',
                "สลิปไม่ผ่าน ฿{$amount}",
            ),
            default => null,
        };
    }
}
