<?php

namespace Tests\Feature;

use App\Models\Court;
use App\Models\Organization;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BookingPaymentApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    /** Authenticate as a LINE customer and return the bearer token. */
    private function customerToken(): string
    {
        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => 'Ubookingtest',
            'displayName' => 'Booking Tester',
        ])->json('token');
    }

    private function everydayCourtId(): string
    {
        return $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');
    }

    public function test_full_flow_create_pay_upload_verify_confirms_booking(): void
    {
        Storage::fake('public');

        $token = $this->customerToken();
        $courtId = $this->everydayCourtId();

        // 1. Create a booking.
        $booking = $this->withToken($token)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => '2026-06-20',
            'start' => '18:00',
            'end' => '19:00',
        ]);

        $booking->assertCreated()
            ->assertJsonPath('data.amount', 250)
            ->assertJsonPath('data.status', 'pending_payment')
            ->assertJsonPath('data.venueId', 'everyday-badminton')
            ->assertJsonPath('data.courtId', $courtId);

        $bookingId = $booking->json('data.id');
        $this->assertStringStartsWith('BK', $booking->json('data.code'));

        // 2. Create a payment.
        $payment = $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId,
            'method' => 'transfer',
        ]);

        $payment->assertCreated()
            ->assertJsonPath('data.status', 'awaiting_slip')
            ->assertJsonPath('data.amount', 250)
            ->assertJsonPath('data.bookingId', $bookingId);

        $paymentId = $payment->json('data.id');

        // 3. Upload a slip -> pending_review with an absolute slipUrl.
        $upload = $this->withToken($token)->postJson("/api/v1/payments/{$paymentId}/upload-slip", [
            'slip' => UploadedFile::fake()->image('slip.png', 600, 800),
        ]);

        $upload->assertOk()
            ->assertJsonPath('data.status', 'pending_review');

        $this->assertStringStartsWith('http', $upload->json('data.slipUrl'));

        // 4. Verify -> approved + booking confirmed.
        $this->withToken($token)->postJson("/api/v1/payments/{$paymentId}/verify")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->withToken($token)->getJson("/api/v1/bookings/{$bookingId}")
            ->assertOk()
            ->assertJsonPath('data.status', 'confirmed');

        // 5. The customer carries a check-in token, but cannot check themselves
        //    in — the counter scans it. See OwnerCheckinTest for that half.
        $this->withToken($token)->getJson("/api/v1/bookings/{$bookingId}")
            ->assertOk()
            ->assertJsonPath('data.checkedInAt', null)
            ->assertJsonStructure(['data' => ['checkinToken']]);

        $this->withToken($token)->postJson("/api/v1/bookings/{$bookingId}/checkin")
            ->assertNotFound();
    }

    public function test_promptpay_instructions_return_a_real_qr_payload_and_bank(): void
    {
        $token = $this->customerToken();
        $courtId = $this->everydayCourtId();

        $bookingId = $this->withToken($token)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => '2026-06-25',
            'start' => '18:00',
            'end' => '20:00', // 2 hours
        ])->assertCreated()->json('data.id');

        $paymentId = $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId,
            'method' => 'promptpay',
        ])->assertCreated()->json('data.id');

        $res = $this->withToken($token)->getJson("/api/v1/payments/{$paymentId}/instructions")
            ->assertOk()
            ->assertJsonPath('method', 'promptpay')
            ->assertJsonPath('bank.bankName', 'กสิกรไทย');

        $payload = $res->json('promptpay.payload');
        $amount = $res->json('amount');

        // EMVCo PromptPay shape: format header, AID, dynamic indicator, the THB amount.
        $this->assertStringStartsWith('000201', $payload);
        $this->assertStringContainsString('0016A000000677010111', $payload);
        $this->assertStringContainsString('010212', $payload); // dynamic (amount present)
        $this->assertStringContainsString('5406'.number_format((float) $amount, 2, '.', ''), $payload);
        // CRC tag is the last 4 hex chars after "6304".
        $this->assertMatchesRegularExpression('/6304[0-9A-F]{4}$/', $payload);
    }

    public function test_customer_can_submit_a_review_and_it_updates_the_summary(): void
    {
        $token = $this->customerToken();

        $res = $this->withToken($token)->postJson('/api/v1/reviews', [
            'venueId' => 'everyday-badminton',
            'rating' => 5,
            'text' => 'สนามดีมาก บริการเยี่ยม',
        ])->assertOk();

        // Newest review appears first, and the summary total matches the real rows.
        $this->assertSame('สนามดีมาก บริการเยี่ยม', $res->json('data.reviews.0.text'));
        $this->assertSame(5, $res->json('data.reviews.0.rating'));
        $this->assertSame(count($res->json('data.reviews')), $res->json('data.total'));
    }

    public function test_wallet_topup_credits_balance_only_after_owner_approval(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');

        $token = $this->customerToken();
        $me = $this->withToken($token)->getJson('/api/v1/auth/me')->json('data');
        $org = Organization::where('slug', 'everyday-badminton')->firstOrFail();
        \App\Models\Wallet::create(['organization_id' => $org->id, 'customer_id' => $me['id'], 'balance' => 0]);

        // Request top-up → pending, returns a real PromptPay QR; balance unchanged.
        $this->app['auth']->forgetGuards();
        $topup = $this->withToken($token)->postJson('/api/v1/wallet/topup', ['amount' => 500])
            ->assertOk()
            ->assertJsonPath('amount', 500);
        $txnId = $topup->json('transactionId');
        $this->assertNotNull($topup->json('promptpay.payload'));

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/wallet')->assertOk()->assertJsonPath('data.balance', 0);

        // Attach slip → pending_review.
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/wallet/topup/{$txnId}/slip", [
            'slip' => UploadedFile::fake()->image('slip.png'),
        ])->assertOk();

        // Owner sees the request and approves it.
        $ownerToken = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test', 'password' => 'password',
        ])->json('token');

        $this->app['auth']->forgetGuards();
        $this->withToken($ownerToken)->getJson('/api/v1/owner/wallet-topups')
            ->assertOk()
            ->assertJsonPath('data.0.id', $txnId);

        $this->app['auth']->forgetGuards();
        $this->withToken($ownerToken)->postJson("/api/v1/owner/wallet-topups/{$txnId}/approve")
            ->assertOk()
            ->assertJsonPath('status', 'completed');

        // Balance now credited.
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/wallet')->assertOk()->assertJsonPath('data.balance', 500);
    }

    public function test_package_purchase_approval_and_redemption_at_booking(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');

        $token = $this->customerToken();
        $courtId = $this->everydayCourtId();

        $package = $this->getJson('/api/v1/packages?venueId=everyday-badminton')->json('data.0');
        $this->assertNotNull($package, 'seeded package required');

        // Buy → pending, returns a real PromptPay QR.
        $purchase = $this->withToken($token)->postJson("/api/v1/packages/{$package['id']}/purchase")
            ->assertOk();
        $purchaseId = $purchase->json('purchaseId');
        $this->assertNotNull($purchase->json('promptpay.payload'));

        // Attach slip → pending_review.
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/packages/purchases/{$purchaseId}/slip", [
            'slip' => UploadedFile::fake()->image('slip.png'),
        ])->assertOk()->assertJsonPath('data.status', 'pending_review');

        // Not usable yet (still pending_review).
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/my-packages')
            ->assertOk()
            ->assertJsonPath('data.0.status', 'pending_review');

        // Owner approves → active.
        $ownerToken = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test', 'password' => 'password',
        ])->json('token');
        $this->app['auth']->forgetGuards();
        $this->withToken($ownerToken)->getJson('/api/v1/owner/package-purchases')
            ->assertOk()->assertJsonPath('data.0.id', $purchaseId);
        $this->app['auth']->forgetGuards();
        $this->withToken($ownerToken)->postJson("/api/v1/owner/package-purchases/{$purchaseId}/approve")
            ->assertOk()->assertJsonPath('status', 'active');

        // Book then pay with the package (1 hour) → confirmed, amount 0, hours deducted.
        $this->app['auth']->forgetGuards();
        $bookingId = $this->withToken($token)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton', 'courtId' => $courtId,
            'date' => '2026-07-01', 'start' => '10:00', 'end' => '11:00',
        ])->assertCreated()->json('data.id');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$bookingId}/pay-with-package", [
            'customerPackageId' => $purchaseId,
        ])->assertOk()
            ->assertJsonPath('data.status', 'confirmed')
            ->assertJsonPath('data.amount', 0);

        $remaining = $package['hours'] - 1;
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/my-packages')
            ->assertOk()
            ->assertJsonPath('data.0.remainingHours', $remaining);
    }

    public function test_double_booking_same_slot_returns_422(): void
    {
        $token = $this->customerToken();
        $courtId = $this->everydayCourtId();

        $payload = [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => '2026-06-21',
            'start' => '18:00',
            'end' => '19:00',
        ];

        $this->withToken($token)->postJson('/api/v1/bookings', $payload)->assertCreated();

        $this->withToken($token)->postJson('/api/v1/bookings', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('start');
    }

    public function test_cancelled_booking_frees_the_slot(): void
    {
        $token = $this->customerToken();
        $courtId = $this->everydayCourtId();

        $payload = [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => '2026-06-22',
            'start' => '18:00',
            'end' => '19:00',
        ];

        $first = $this->withToken($token)->postJson('/api/v1/bookings', $payload)->assertCreated();

        $this->withToken($token)
            ->postJson("/api/v1/bookings/{$first->json('data.id')}/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');

        // Same slot is bookable again after cancellation.
        $this->withToken($token)->postJson('/api/v1/bookings', $payload)->assertCreated();
    }

    public function test_bookings_are_scoped_to_the_current_customer(): void
    {
        $tokenA = $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => 'UcustomerA',
            'displayName' => 'A',
        ])->json('token');

        $tokenB = $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => 'UcustomerB',
            'displayName' => 'B',
        ])->json('token');

        $courtId = $this->everydayCourtId();

        $booking = $this->withToken($tokenA)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => '2026-06-23',
            'start' => '18:00',
            'end' => '19:00',
        ])->assertCreated();

        // The Sanctum guard caches the resolved user within a single test
        // process; forget it so the next request authenticates as B.
        $this->app['auth']->forgetGuards();

        // Customer B cannot read customer A's booking.
        $this->withToken($tokenB)
            ->getJson("/api/v1/bookings/{$booking->json('data.id')}")
            ->assertNotFound();

        $this->app['auth']->forgetGuards();

        $this->withToken($tokenB)->getJson('/api/v1/bookings')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }
}
