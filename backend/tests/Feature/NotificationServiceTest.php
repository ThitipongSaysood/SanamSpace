<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Court;
use App\Models\Customer;
use App\Models\Notification;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Services\NotificationService;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Unit coverage for the notification wording of each event (#3). The HTTP
 * wiring (a slip approval reaching the customer's bell) is proven in
 * BookingPaymentApiTest; this pins the title of every other event.
 */
class NotificationServiceTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;

    private Customer $customer;

    private Court $court;

    private NotificationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);

        $this->org = Organization::where('slug', 'everyday-badminton')->firstOrFail();
        // A fresh customer, so the seeder's own notifications/wallet for the
        // seeded customer don't collide with what these assertions create.
        $this->customer = Customer::create([
            'organization_id' => $this->org->id,
            'display_name' => 'Notify Tester',
        ]);
        $this->court = Court::where('organization_id', $this->org->id)->firstOrFail();
        $this->service = app(NotificationService::class);
    }

    private function makeBooking(string $status = 'pending_payment'): Booking
    {
        return Booking::create([
            'organization_id' => $this->org->id,
            'branch_id' => $this->court->branch_id,
            'court_id' => $this->court->id,
            'customer_id' => $this->customer->id,
            'code' => 'BKTEST01',
            'date' => '2026-08-10',
            'start' => '18:00',
            'end' => '19:00',
            'amount' => 250,
            'status' => $status,
        ]);
    }

    /** The most recent notification for the seeded customer. */
    private function latest(): Notification
    {
        return Notification::where('customer_id', $this->customer->id)
            ->orderByDesc('created_at')
            ->firstOrFail();
    }

    public function test_payment_approved_notifies_with_the_booking_code(): void
    {
        $booking = $this->makeBooking();
        $payment = Payment::create([
            'organization_id' => $this->org->id,
            'booking_id' => $booking->id,
            'customer_id' => $this->customer->id,
            'method' => 'transfer',
            'amount' => 250,
            'status' => 'approved',
        ]);

        $this->service->paymentApproved($payment);

        $n = $this->latest();
        $this->assertSame('ชำระเงินสำเร็จ', $n->title);
        $this->assertStringContainsString('BKTEST01', $n->body);
        $this->assertSame($this->org->id, $n->organization_id);
    }

    public function test_payment_rejected_notifies(): void
    {
        $booking = $this->makeBooking();
        $payment = Payment::create([
            'organization_id' => $this->org->id,
            'booking_id' => $booking->id,
            'customer_id' => $this->customer->id,
            'method' => 'transfer',
            'amount' => 250,
            'status' => 'rejected',
        ]);

        $this->service->paymentRejected($payment);

        $this->assertSame('สลิปไม่ผ่านการตรวจสอบ', $this->latest()->title);
    }

    public function test_refund_approved_and_rejected_notify(): void
    {
        $booking = $this->makeBooking();

        $refund = Refund::create([
            'organization_id' => $this->org->id,
            'booking_id' => $booking->id,
            'customer_id' => $this->customer->id,
            'amount' => 250,
            'reason' => 'test',
            'status' => 'approved',
            'requested_by' => 'customer',
        ]);

        $this->service->refundApproved($refund);
        $this->service->refundRejected($refund);

        // Both events land in the customer's bell (asserted by title rather than
        // recency — the two creates share a same-second timestamp).
        $titles = Notification::where('customer_id', $this->customer->id)->pluck('title');
        $this->assertContains('คืนเงินสำเร็จ', $titles);
        $this->assertContains('คำขอคืนเงินไม่ได้รับอนุมัติ', $titles);
    }

    public function test_topup_approved_notifies(): void
    {
        $wallet = Wallet::create([
            'organization_id' => $this->org->id,
            'customer_id' => $this->customer->id,
            'balance' => 0,
        ]);
        $txn = WalletTransaction::create([
            'wallet_id' => $wallet->id,
            'txn_date' => '10 ส.ค.',
            'label' => 'เติมเงิน',
            'amount' => 500,
            'status' => 'completed',
            'sort_order' => 0,
        ]);

        $this->service->topupApproved($txn);

        $this->assertSame('เติมเงินสำเร็จ', $this->latest()->title);
    }

    public function test_booking_cancelled_notifies(): void
    {
        $booking = $this->makeBooking('confirmed');

        $this->service->bookingCancelled($booking);

        $n = $this->latest();
        $this->assertSame('การจองถูกยกเลิก', $n->title);
        $this->assertStringContainsString('BKTEST01', $n->body);
    }
}
