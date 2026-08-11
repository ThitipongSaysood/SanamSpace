<?php

namespace App\Services\Slip;

use App\Models\PaymentSlip;
use App\Support\SlipVerification;
use Illuminate\Support\Facades\Http;

/**
 * SlipOK driver — verifies a slip by its QR payload against the SlipOK API.
 *
 * Set `SLIP_VERIFY_DRIVER=slipok`, `SLIP_VERIFY_ENDPOINT` (the full branch URL
 * SlipOK gives you, e.g. https://api.slipok.com/api/line/apikey/{branchId}) and
 * `SLIP_VERIFY_KEY`. It reads the QR the customer app decoded on upload; a slip
 * with no QR (or a network error) returns fail() and drops to manual review.
 *
 * The response field mapping follows SlipOK's documented shape; adjust here if
 * your account returns different keys — nothing else changes.
 */
class SlipOkVerifier implements SlipVerifier
{
    public function __construct(private string $endpoint, private string $apiKey) {}

    public function verify(PaymentSlip $slip): SlipVerification
    {
        if (blank($slip->qr_payload) || blank($this->endpoint) || blank($this->apiKey)) {
            return SlipVerification::fail();
        }

        $res = Http::withHeaders(['x-authorization' => $this->apiKey])
            ->asJson()
            ->timeout(15)
            ->post($this->endpoint, ['data' => $slip->qr_payload, 'log' => true]);

        // A non-2xx or success:false (fake / already-used / unreadable) is not
        // an approval — it falls through to a human.
        if (! $res->successful() || $res->json('success') !== true) {
            return SlipVerification::fail();
        }

        $d = (array) $res->json('data');

        return new SlipVerification(
            ok: true,
            amount: isset($d['amount']) ? (float) $d['amount'] : null,
            receiverRef: data_get($d, 'receiver.account.value')
                ?? data_get($d, 'receiver.account.bank.account')
                ?? data_get($d, 'receiver.displayName'),
            senderName: data_get($d, 'sender.displayName') ?? data_get($d, 'sender.name'),
            transRef: $d['transRef'] ?? null,
            transDate: $d['transDate'] ?? $d['transTimestamp'] ?? null,
            raw: (array) $res->json(),
        );
    }
}
