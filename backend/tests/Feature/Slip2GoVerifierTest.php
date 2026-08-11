<?php

namespace Tests\Feature;

use App\Models\PaymentSlip;
use App\Services\Slip\Slip2GoVerifier;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** The Slip2Go driver maps the provider response into our SlipVerification. */
class Slip2GoVerifierTest extends TestCase
{
    private function verifier(): Slip2GoVerifier
    {
        return new Slip2GoVerifier('https://connect.slip2go.test/api/verify-slip/qr-code/info', 'TEST-SECRET');
    }

    public function test_it_maps_a_successful_response(): void
    {
        Http::fake(['*' => Http::response([
            'code' => '200000',
            'message' => 'Slip found.',
            'data' => [
                'amount' => 250,
                'transRef' => '015220000',
                'dateTime' => '2026-08-11T18:00:00+07:00',
                'sender' => ['account' => ['name' => 'คุณผู้โอน']],
                'receiver' => ['account' => ['name' => 'สนาม', 'bank' => ['account' => 'xxx-x-x5678-x']]],
            ],
        ], 200)]);

        $v = $this->verifier()->verify(new PaymentSlip(['qr_payload' => 'QRDATA']));

        $this->assertTrue($v->ok);
        $this->assertSame(250.0, $v->amount);
        $this->assertSame('015220000', $v->transRef);
        $this->assertStringContainsString('5678', (string) $v->receiverRef);
        $this->assertSame('คุณผู้โอน', $v->senderName);
    }

    public function test_it_sends_the_qr_as_bearer_and_payload(): void
    {
        Http::fake(['*' => Http::response(['code' => '200000', 'data' => ['amount' => 100]], 200)]);

        $this->verifier()->verify(new PaymentSlip(['qr_payload' => 'QRDATA']));

        Http::assertSent(fn ($req) => $req->hasHeader('Authorization', 'Bearer TEST-SECRET')
            && data_get($req->data(), 'payload.qrCode') === 'QRDATA');
    }

    public function test_a_non_success_code_is_a_failure(): void
    {
        Http::fake(['*' => Http::response(['code' => '400400', 'message' => 'slip not found'], 200)]);

        $this->assertFalse($this->verifier()->verify(new PaymentSlip(['qr_payload' => 'Q']))->ok);
    }

    public function test_a_slip_without_a_qr_is_not_sent(): void
    {
        Http::fake();

        $this->assertFalse($this->verifier()->verify(new PaymentSlip([]))->ok);
        Http::assertNothingSent();
    }
}
