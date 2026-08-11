<?php

namespace App\Services\Slip;

use App\Models\PaymentSlip;
use App\Support\SlipVerification;
use Illuminate\Support\Facades\Http;

/**
 * Slip2Go driver — verifies a slip by its QR payload against the Slip2Go API.
 *
 * Set `SLIP_VERIFY_DRIVER=slip2go` and `SLIP_VERIFY_KEY` (the API Secret from
 * the Slip2Go dashboard). `SLIP_VERIFY_ENDPOINT` is optional and only needed to
 * point at a different host — it defaults to the documented QR-code endpoint.
 *
 * Request:  POST { "payload": { "qrCode": "<qr>" } }  with a Bearer secret.
 * Response: { "code": "200000", "data": { amount, transRef, dateTime,
 *            sender.account.name, receiver.account.{name,bank.account} } }.
 * A code that is not a 2xxxxx success (fake / duplicate / unreadable), a
 * non-2xx HTTP status, a missing QR, or a network error all return fail() and
 * drop the slip to manual review.
 *
 * The field mapping follows Slip2Go's documented shape; if your account returns
 * different keys, adjust the data_get() paths below — nothing else changes.
 *
 * @see https://slip2go.com/guide
 */
class Slip2GoVerifier implements SlipVerifier
{
    private const DEFAULT_ENDPOINT = 'https://connect.slip2go.com/api/verify-slip/qr-code/info';

    public function __construct(private string $endpoint, private string $apiKey)
    {
        if (blank($this->endpoint)) {
            $this->endpoint = self::DEFAULT_ENDPOINT;
        }
    }

    public function verify(PaymentSlip $slip): SlipVerification
    {
        if (blank($slip->qr_payload) || blank($this->apiKey)) {
            return SlipVerification::fail();
        }

        $res = Http::withToken($this->apiKey)
            ->asJson()
            ->timeout(15)
            ->post($this->endpoint, ['payload' => ['qrCode' => $slip->qr_payload]]);

        // Slip2Go returns "200000" when the slip is found and real; any other
        // code (or a non-2xx HTTP status) is not an approval.
        if (! $res->successful() || ! str_starts_with((string) $res->json('code'), '2000')) {
            return SlipVerification::fail();
        }

        $d = (array) $res->json('data');

        return new SlipVerification(
            ok: true,
            amount: isset($d['amount']) ? (float) $d['amount'] : null,
            // Prefer a value carrying digits (PromptPay proxy / masked account
            // number) so the receiver match can compare against the venue's
            // account; fall back to the name when that is all Slip2Go returns.
            receiverRef: data_get($d, 'receiver.proxy.value')
                ?? data_get($d, 'receiver.account.bank.account')
                ?? data_get($d, 'receiver.account.value')
                ?? data_get($d, 'receiver.account.name'),
            senderName: data_get($d, 'sender.account.name') ?? data_get($d, 'sender.name'),
            transRef: $d['transRef'] ?? $d['referenceId'] ?? null,
            transDate: $d['dateTime'] ?? $d['transDate'] ?? null,
            raw: (array) $res->json(),
        );
    }
}
