<?php

namespace App\Services\Slip;

use App\Models\PaymentSlip;
use App\Support\SlipVerification;

/**
 * Default driver: verifies nothing (no provider configured). Every slip stays
 * in the manual queue — so auto-approve is inert until a real driver is wired.
 */
class NullSlipVerifier implements SlipVerifier
{
    public function verify(PaymentSlip $slip): SlipVerification
    {
        return SlipVerification::fail();
    }
}
