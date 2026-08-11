<?php

namespace Tests\Feature;

use App\Models\PaymentSlip;
use App\Services\Slip\SlipOkVerifier;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** The SlipOK driver maps the provider response into our SlipVerification. */
class SlipOkVerifierTest extends TestCase
{
    private function verifier(): SlipOkVerifier
    {
        return new SlipOkVerifier('https://api.slipok.test/branch', 'TEST-KEY');
    }

    public function test_it_maps_a_successful_response(): void
    {
        Http::fake(['*' => Http::response([
            'success' => true,
            'data' => [
                'amount' => 250,
                'transRef' => '015220000',
                'transDate' => '2026-08-11',
                'receiver' => ['displayName' => 'สนาม', 'account' => ['value' => 'xxx-x-x5678-x']],
                'sender' => ['displayName' => 'คุณผู้โอน'],
            ],
        ], 200)]);

        $v = $this->verifier()->verify(new PaymentSlip(['qr_payload' => 'QRDATA']));

        $this->assertTrue($v->ok);
        $this->assertSame(250.0, $v->amount);
        $this->assertSame('015220000', $v->transRef);
        $this->assertStringContainsString('5678', (string) $v->receiverRef);
        $this->assertSame('คุณผู้โอน', $v->senderName);
    }

    public function test_success_false_is_a_failure(): void
    {
        Http::fake(['*' => Http::response(['success' => false, 'message' => 'สลิปซ้ำ'], 200)]);

        $this->assertFalse($this->verifier()->verify(new PaymentSlip(['qr_payload' => 'Q']))->ok);
    }

    public function test_a_slip_without_a_qr_is_not_sent(): void
    {
        Http::fake();

        $this->assertFalse($this->verifier()->verify(new PaymentSlip([]))->ok);
        Http::assertNothingSent();
    }
}
