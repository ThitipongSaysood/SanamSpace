<?php

namespace App\Services\Slip;

use App\Models\PaymentSlip;
use App\Support\SlipVerification;

/**
 * The seam a slip-verification provider plugs into. Phase 1 default is
 * NullSlipVerifier (no external call); a SlipOK/EasySlip driver implements this
 * and is bound in AppServiceProvider via config('services.slip.driver').
 */
interface SlipVerifier
{
    public function verify(PaymentSlip $slip): SlipVerification;
}
