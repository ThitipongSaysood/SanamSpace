<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Payment;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * What the customer is asked to do next, given where their money actually is.
 *
 * The bug these lock down: a booking sits at `pending_payment` both before
 * anyone pays AND while the venue is checking the slip. The app read only the
 * booking status, so someone who had already transferred was shown
 * "ไปชำระเงิน" again — and tapping it opened a second Payment row, leaving the
 * venue with two slips for one booking.
 */
class PaymentFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function customerToken(): string
    {
        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => 'Uflow',
            'displayName' => 'ลูกค้าจ่ายเงิน',
        ])->json('token');
    }

    private function book(string $token, string $date = '2026-11-05'): string
    {
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');

        return $this->withToken($token)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => $date,
            'start' => '18:00',
            'end' => '19:00',
        ])->assertCreated()->json('data.id');
    }

    private function bookingBody(string $token, string $id): array
    {
        return $this->withToken($token)->getJson("/api/v1/bookings/{$id}")->assertOk()->json('data');
    }

    /** Nobody has paid: the app should ask for payment. */
    public function test_a_new_booking_reports_no_payment_yet(): void
    {
        $token = $this->customerToken();
        $body = $this->bookingBody($token, $this->book($token));

        $this->assertSame('pending_payment', $body['status']);
        $this->assertNull($body['paymentStatus']);
    }

    /**
     * The actual reported bug: after uploading a slip the booking still reads
     * pending_payment, so the app must have something else to go on.
     */
    public function test_after_uploading_a_slip_the_booking_says_it_is_under_review(): void
    {
        Storage::fake('public');
        $token = $this->customerToken();
        $bookingId = $this->book($token);

        $paymentId = $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId,
            'method' => 'transfer',
        ])->assertCreated()->json('data.id');

        $this->withToken($token)->postJson("/api/v1/payments/{$paymentId}/upload-slip", [
            'slip' => UploadedFile::fake()->image('slip.png'),
        ])->assertOk();

        $body = $this->bookingBody($token, $bookingId);

        // Still pending_payment — correct, the venue has not approved yet…
        $this->assertSame('pending_payment', $body['status']);
        // …but now the app can tell that asking them to pay again is wrong.
        $this->assertSame('pending_review', $body['paymentStatus']);
    }

    /** Tapping "pay" twice must not open a second payment. */
    public function test_starting_payment_twice_reuses_the_same_payment(): void
    {
        $token = $this->customerToken();
        $bookingId = $this->book($token);

        $first = $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId, 'method' => 'transfer',
        ])->assertCreated()->json('data.id');

        $second = $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId, 'method' => 'transfer',
        ])->assertOk()->json('data.id');

        $this->assertSame($first, $second);
        $this->assertSame(1, Payment::where('booking_id', $bookingId)->count());
    }

    /** …not even once the slip is with the venue. */
    public function test_a_second_payment_cannot_be_opened_while_a_slip_is_under_review(): void
    {
        Storage::fake('public');
        $token = $this->customerToken();
        $bookingId = $this->book($token);

        $paymentId = $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId, 'method' => 'transfer',
        ])->json('data.id');

        $this->withToken($token)->postJson("/api/v1/payments/{$paymentId}/upload-slip", [
            'slip' => UploadedFile::fake()->image('slip.png'),
        ])->assertOk();

        $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId, 'method' => 'promptpay',
        ])->assertOk()->assertJsonPath('data.id', $paymentId);

        $this->assertSame(1, Payment::where('booking_id', $bookingId)->count());
    }

    /** Changing your mind before sending a slip should just change the method. */
    public function test_switching_method_before_sending_a_slip_updates_it(): void
    {
        $token = $this->customerToken();
        $bookingId = $this->book($token);

        $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId, 'method' => 'promptpay',
        ])->assertCreated();

        $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId, 'method' => 'transfer',
        ])->assertOk()->assertJsonPath('data.method', 'transfer');

        $this->assertSame(1, Payment::where('booking_id', $bookingId)->count());
    }

    /** A rejected slip is the one case where paying again is right. */
    public function test_after_a_rejected_slip_a_fresh_payment_can_be_opened(): void
    {
        Storage::fake('public');
        $token = $this->customerToken();
        $bookingId = $this->book($token);

        $paymentId = $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId, 'method' => 'transfer',
        ])->json('data.id');

        $this->withToken($token)->postJson("/api/v1/payments/{$paymentId}/upload-slip", [
            'slip' => UploadedFile::fake()->image('slip.png'),
        ])->assertOk();

        Payment::where('id', $paymentId)->update(['status' => 'rejected']);

        $this->assertSame('rejected', $this->bookingBody($token, $bookingId)['paymentStatus']);

        $retry = $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId, 'method' => 'transfer',
        ])->assertCreated()->json('data.id');

        $this->assertNotSame($paymentId, $retry);
        // The newest wins, so the app stops saying "rejected" once they retry.
        $this->assertSame('awaiting_slip', $this->bookingBody($token, $bookingId)['paymentStatus']);
    }

    /** Paying a booking that is already settled is a mistake, not a payment. */
    public function test_a_confirmed_booking_cannot_be_paid_again(): void
    {
        $token = $this->customerToken();
        $bookingId = $this->book($token);
        Booking::where('id', $bookingId)->update(['status' => 'confirmed']);

        $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId, 'method' => 'transfer',
        ])->assertStatus(422);

        $this->assertSame(0, Payment::where('booking_id', $bookingId)->count());
    }

    public function test_a_cancelled_booking_cannot_be_paid(): void
    {
        $token = $this->customerToken();
        $bookingId = $this->book($token);
        Booking::where('id', $bookingId)->update(['status' => 'cancelled']);

        $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId, 'method' => 'transfer',
        ])->assertStatus(422);
    }

    /** Once the venue approves, the booking is confirmed and nothing is owed. */
    public function test_approval_confirms_the_booking(): void
    {
        Storage::fake('public');
        $token = $this->customerToken();
        $bookingId = $this->book($token);

        $paymentId = $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId, 'method' => 'transfer',
        ])->json('data.id');

        $this->withToken($token)->postJson("/api/v1/payments/{$paymentId}/upload-slip", [
            'slip' => UploadedFile::fake()->image('slip.png'),
        ])->assertOk();

        $this->app['auth']->forgetGuards();
        $owner = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test', 'password' => 'password',
        ])->json('token');

        $this->app['auth']->forgetGuards();
        $this->withToken($owner)->postJson("/api/v1/owner/payments/{$paymentId}/verify")->assertOk();

        $this->app['auth']->forgetGuards();
        $body = $this->bookingBody($token, $bookingId);
        $this->assertSame('confirmed', $body['status']);
        $this->assertSame('approved', $body['paymentStatus']);
    }
}
