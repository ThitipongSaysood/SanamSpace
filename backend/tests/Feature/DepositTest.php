<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\OrganizationSetting;
use App\Models\Payment;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Deposits: the court is held for part of the money, the rest is paid later.
 *
 * The thing this changes everywhere else is that "confirmed" stops meaning
 * "paid in full". Anything that assumed the two were the same has to key on the
 * money instead.
 */
class DepositTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
        Storage::fake('public');
    }

    private function customerToken(string $lineId = 'Udeposit'): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => $lineId,
            'displayName' => 'คุณมัดจำ',
        ])->json('token');
    }

    private function ownerToken(): string
    {
        $this->app['auth']->forgetGuards();

        $token = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');

        $this->app['auth']->forgetGuards();

        return $token;
    }

    /** Turn deposits on for the seeded venue. */
    private function deposit(string $type, float $value): void
    {
        $orgId = \App\Models\Organization::where('slug', 'everyday-badminton')->value('id');

        OrganizationSetting::query()->updateOrCreate(
            ['organization_id' => $orgId],
            ['deposit_enabled' => true, 'deposit_type' => $type, 'deposit_value' => $value],
        );
    }

    private function book(string $token, string $date = '2026-11-01'): array
    {
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');
        $this->app['auth']->forgetGuards();

        return $this->withToken($token)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => $date,
            'start' => '18:00',
            'end' => '19:00',
        ])->assertCreated()->json('data');
    }

    /** Take the slip through to approved. Returns the payment id. */
    private function payAndApprove(string $token, string $bookingId): string
    {
        $paymentId = $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId,
            'method' => 'transfer',
        ])->assertCreated()->json('data.id');

        $this->withToken($token)->postJson("/api/v1/payments/{$paymentId}/upload-slip", [
            'slip' => UploadedFile::fake()->image('slip.png'),
        ])->assertOk();

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/payments/{$paymentId}/verify")->assertOk();

        $this->app['auth']->forgetGuards();

        return $paymentId;
    }

    // ---- how much is due -------------------------------------------------

    /** Off by default: nothing about the existing flow changes. */
    public function test_without_deposits_the_whole_amount_is_due(): void
    {
        $token = $this->customerToken();
        $booking = $this->book($token);

        $this->assertSame(0.0, (float) $booking['depositAmount']);
        $this->assertSame((float) $booking['amount'], (float) $booking['outstandingAmount']);

        $paymentId = $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $booking['id'], 'method' => 'transfer',
        ])->assertCreated()->json('data.id');

        $this->assertSame((float) $booking['amount'], (float) Payment::find($paymentId)->amount);
    }

    /** A percentage of the booking, snapshotted when it is made. */
    public function test_a_percentage_deposit_is_calculated_from_the_total(): void
    {
        $this->deposit('percent', 30);

        $booking = $this->book($this->customerToken());

        $this->assertSame(75.0, (float) $booking['depositAmount']); // 30% of 250
        $this->assertSame(250.0, (float) $booking['amount']);
    }

    /** A flat amount, for venues that charge the same whatever the slot. */
    public function test_a_fixed_deposit_is_the_same_every_time(): void
    {
        $this->deposit('fixed', 100);

        $booking = $this->book($this->customerToken());

        $this->assertSame(100.0, (float) $booking['depositAmount']);
    }

    /** A deposit at or above the price is just paying in full. */
    public function test_a_deposit_larger_than_the_booking_is_not_a_deposit(): void
    {
        $this->deposit('fixed', 5000);

        $booking = $this->book($this->customerToken());

        $this->assertSame(0.0, (float) $booking['depositAmount']);
    }

    /** The payment asks for the deposit, not the whole thing. */
    public function test_the_first_payment_asks_for_the_deposit(): void
    {
        $this->deposit('percent', 40);
        $token = $this->customerToken();
        $booking = $this->book($token);

        $paymentId = $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $booking['id'], 'method' => 'transfer',
        ])->assertCreated()->json('data.id');

        $this->assertSame(100.0, (float) Payment::find($paymentId)->amount); // 40% of 250
    }

    // ---- what the deposit buys -------------------------------------------

    /** The whole point: the deposit holds the court, with a balance left. */
    public function test_paying_the_deposit_confirms_the_booking_and_leaves_a_balance(): void
    {
        $this->deposit('percent', 40);
        $token = $this->customerToken();
        $booking = $this->book($token);

        $this->payAndApprove($token, $booking['id']);

        $after = $this->withToken($token)->getJson("/api/v1/bookings/{$booking['id']}")
            ->assertOk()->json('data');

        $this->assertSame('confirmed', $after['status'], 'the slot is held');
        $this->assertSame(100.0, (float) $after['paidAmount']);
        $this->assertSame(150.0, (float) $after['outstandingAmount']);
    }

    /** The second payment asks for what is left, not the deposit again. */
    public function test_the_balance_can_be_paid_afterwards(): void
    {
        $this->deposit('percent', 40);
        $token = $this->customerToken();
        $booking = $this->book($token);

        $this->payAndApprove($token, $booking['id']);

        $second = $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $booking['id'], 'method' => 'transfer',
        ])->assertCreated()->json('data');

        $this->assertSame(150.0, (float) $second['amount']);

        $this->withToken($token)->postJson("/api/v1/payments/{$second['id']}/upload-slip", [
            'slip' => UploadedFile::fake()->image('slip2.png'),
        ])->assertOk();

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/payments/{$second['id']}/verify")->assertOk();

        $this->app['auth']->forgetGuards();
        $after = $this->withToken($token)->getJson("/api/v1/bookings/{$booking['id']}")
            ->assertOk()->json('data');

        $this->assertSame(250.0, (float) $after['paidAmount']);
        $this->assertSame(0.0, (float) $after['outstandingAmount']);
    }

    /** Once it is fully paid, asking to pay again is a mistake. */
    public function test_a_settled_booking_refuses_another_payment(): void
    {
        $this->deposit('percent', 40);
        $token = $this->customerToken();
        $booking = $this->book($token);

        Booking::find($booking['id'])->update(['paid_amount' => 250, 'status' => 'confirmed']);

        $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $booking['id'], 'method' => 'transfer',
        ])->assertStatus(422);
    }

    // ---- the counter ------------------------------------------------------

    /** The balance usually arrives as cash at the desk. */
    public function test_the_counter_can_take_the_balance(): void
    {
        $this->deposit('percent', 40);
        $token = $this->customerToken();
        $booking = $this->book($token);
        $this->payAndApprove($token, $booking['id']);

        $after = $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/bookings/{$booking['id']}/settle", ['method' => 'cash'])
            ->assertOk()->json('data');

        $this->assertSame(0.0, (float) $after['outstandingAmount']);
        $this->assertSame(250.0, (float) $after['paidAmount']);

        // Recorded as money received, in the same place as every other payment.
        $this->assertSame(
            150.0,
            (float) Payment::where('booking_id', $booking['id'])->where('method', 'cash')->value('amount'),
        );
    }

    /** Taking more than is owed would invent revenue. */
    public function test_the_counter_cannot_take_more_than_is_owed(): void
    {
        $this->deposit('percent', 40);
        $token = $this->customerToken();
        $booking = $this->book($token);
        $this->payAndApprove($token, $booking['id']);

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/bookings/{$booking['id']}/settle", ['amount' => 900])
            ->assertStatus(422);
    }

    /** And settling a booking that owes nothing is a mistake, not a no-op. */
    public function test_settling_a_paid_booking_is_refused(): void
    {
        $token = $this->customerToken();
        $booking = $this->book($token);
        $this->payAndApprove($token, $booking['id']);

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/bookings/{$booking['id']}/settle")
            ->assertStatus(422);
    }

    /** A walk-in taken as confirmed was paid at the counter, so owes nothing. */
    public function test_a_confirmed_walk_in_owes_nothing(): void
    {
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');

        $body = $this->withToken($this->ownerToken())->postJson('/api/v1/owner/bookings', [
            'courtId' => $courtId,
            'date' => '2026-11-09',
            'start' => '18:00',
            'end' => '19:00',
            'customerName' => 'คุณเดินเข้ามา',
        ])->assertCreated()->json('data');

        $this->assertSame(0.0, (float) $body['outstandingAmount']);
    }

    /** The venue can switch deposits on from its own settings screen. */
    public function test_the_owner_can_configure_deposits(): void
    {
        $body = $this->withToken($this->ownerToken())->putJson('/api/v1/owner/settings', [
            'depositEnabled' => true,
            'depositType' => 'percent',
            'depositValue' => 25,
        ])->assertOk()->json('data');

        $this->assertTrue($body['depositEnabled']);
        $this->assertSame('percent', $body['depositType']);
        $this->assertSame(25.0, (float) $body['depositValue']);
    }
}
