<?php

namespace Tests\Feature;

use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Customer side of the refund flow: REQUEST a refund for an own, paid booking
 * and list those requests. Owner/Admin approval is covered elsewhere.
 */
class RefundRequestTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    /** Authenticate as a LINE customer and return the bearer token. */
    private function customerToken(string $lineUserId = 'Urefundtest', string $name = 'Refund Tester'): string
    {
        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => $lineUserId,
            'displayName' => $name,
        ])->json('token');
    }

    private function everydayCourtId(): string
    {
        return $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');
    }

    /**
     * Create a booking and take it through payment to `approved` so the booking
     * is `confirmed` (eligible for a refund). Returns the booking id.
     */
    private function makePaidBooking(string $token, string $date = '2026-06-20'): string
    {
        Storage::fake('public');

        $bookingId = $this->withToken($token)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $this->everydayCourtId(),
            'date' => $date,
            'start' => '18:00',
            'end' => '19:00',
        ])->assertCreated()->json('data.id');

        $paymentId = $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId,
            'method' => 'transfer',
        ])->assertCreated()->json('data.id');

        $this->withToken($token)->postJson("/api/v1/payments/{$paymentId}/upload-slip", [
            'slip' => UploadedFile::fake()->image('slip.png', 600, 800),
        ])->assertOk();

        $this->withToken($token)->postJson("/api/v1/payments/{$paymentId}/verify")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        return $bookingId;
    }

    public function test_customer_can_request_a_refund_for_a_paid_booking(): void
    {
        $token = $this->customerToken();
        $bookingId = $this->makePaidBooking($token);

        $res = $this->withToken($token)->postJson("/api/v1/bookings/{$bookingId}/refund", [
            'reason' => 'ฝนตกหนัก มาไม่ได้',
        ]);

        $res->assertCreated()
            ->assertJsonPath('data.bookingId', $bookingId)
            ->assertJsonPath('data.status', 'requested')
            ->assertJsonPath('data.requestedBy', 'customer')
            ->assertJsonPath('data.amount', 250)
            ->assertJsonPath('data.reason', 'ฝนตกหนัก มาไม่ได้');

        $this->assertStringStartsWith('BK', $res->json('data.bookingCode'));

        $this->assertDatabaseHas('refunds', [
            'booking_id' => $bookingId,
            'status' => 'requested',
            'requested_by' => 'customer',
        ]);
    }

    public function test_duplicate_refund_request_is_rejected(): void
    {
        $token = $this->customerToken();
        $bookingId = $this->makePaidBooking($token);

        $this->withToken($token)->postJson("/api/v1/bookings/{$bookingId}/refund")
            ->assertCreated();

        $this->withToken($token)->postJson("/api/v1/bookings/{$bookingId}/refund")
            ->assertStatus(422)
            ->assertJsonValidationErrors('booking');

        $this->assertSame(1, \App\Models\Refund::where('booking_id', $bookingId)->count());
    }

    public function test_refund_request_rejected_for_an_unpaid_booking(): void
    {
        $token = $this->customerToken();

        // Booking created but never paid → still pending_payment, amount > 0.
        $bookingId = $this->withToken($token)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $this->everydayCourtId(),
            'date' => '2026-06-28',
            'start' => '18:00',
            'end' => '19:00',
        ])->assertCreated()->json('data.id');

        $this->withToken($token)->postJson("/api/v1/bookings/{$bookingId}/refund")
            ->assertStatus(422)
            ->assertJsonValidationErrors('booking');

        $this->assertDatabaseCount('refunds', 0);
    }

    public function test_refunds_index_lists_only_the_current_customers_requests(): void
    {
        $token = $this->customerToken();
        $bookingId = $this->makePaidBooking($token);

        $this->withToken($token)->postJson("/api/v1/bookings/{$bookingId}/refund")
            ->assertCreated();

        $this->app['auth']->forgetGuards();

        $this->withToken($token)->getJson('/api/v1/refunds')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.bookingId', $bookingId)
            ->assertJsonPath('data.0.status', 'requested');
    }

    public function test_cannot_request_a_refund_for_another_customers_booking(): void
    {
        $tokenA = $this->customerToken('UrefundA', 'A');
        $bookingId = $this->makePaidBooking($tokenA);

        // The Sanctum guard caches the resolved user within a test process;
        // forget it so the next request authenticates as B.
        $this->app['auth']->forgetGuards();

        $tokenB = $this->customerToken('UrefundB', 'B');

        $this->withToken($tokenB)->postJson("/api/v1/bookings/{$bookingId}/refund")
            ->assertNotFound();

        $this->assertDatabaseCount('refunds', 0);
    }
}
