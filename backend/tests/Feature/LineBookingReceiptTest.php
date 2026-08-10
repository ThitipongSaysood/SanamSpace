<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Court;
use App\Models\Customer;
use App\Models\LineMessageTemplate;
use App\Models\LineProfile;
use App\Models\Organization;
use App\Models\OrganizationSetting;
use App\Models\Payment;
use App\Services\NotificationService;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * A booking event pushes the venue's LINE receipt to the customer — and stays
 * silent, never erroring, when there is nothing it can send.
 */
class LineBookingReceiptTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
        Http::fake(['*' => Http::response([], 200)]);
    }

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    private function setToken(?string $token): void
    {
        OrganizationSetting::query()->updateOrCreate(
            ['organization_id' => $this->org()->id],
            ['line_messaging_token' => $token],
        );
    }

    private function customer(bool $withLine): Customer
    {
        $c = Customer::create([
            'organization_id' => $this->org()->id,
            'display_name' => 'สมชาย ใจดี',
            'phone' => '0993964196',
        ]);
        if ($withLine) {
            LineProfile::create([
                'customer_id' => $c->id,
                'line_user_id' => 'U'.Str::random(10),
                'display_name' => 'สมชาย',
            ]);
        }

        return $c;
    }

    private function bookingFor(Customer $c): Booking
    {
        $court = Court::where('organization_id', $this->org()->id)->firstOrFail();

        return Booking::create([
            'organization_id' => $this->org()->id,
            'branch_id' => $court->branch_id,
            'court_id' => $court->id,
            'customer_id' => $c->id,
            'code' => 'BKF-TEST-'.Str::random(4),
            'date' => '2026-08-15',
            'start' => '09:00',
            'end' => '10:00',
            'amount' => 450,
            'status' => 'confirmed',
        ]);
    }

    private function approvePaymentFor(Booking $booking): void
    {
        $payment = Payment::create([
            'organization_id' => $this->org()->id,
            'booking_id' => $booking->id,
            'customer_id' => $booking->customer_id,
            'method' => 'wallet',
            'amount' => 450,
            'status' => 'approved',
        ]);

        app(NotificationService::class)->paymentApproved($payment->fresh(['booking']));
    }

    public function test_confirming_a_booking_pushes_a_flex_receipt_with_real_values(): void
    {
        $this->setToken('test-token');
        $booking = $this->bookingFor($this->customer(withLine: true));

        $this->approvePaymentFor($booking);

        Http::assertSent(function ($request) {
            $body = $request->data();
            $json = json_encode($body, JSON_UNESCAPED_UNICODE);

            return str_contains($request->url(), '/message/push')
                && ($body['messages'][0]['type'] ?? null) === 'flex'
                && str_contains($json, 'สมชาย ใจดี')   // {{customerName}} substituted
                && str_contains($json, '450');          // {{amount}}
        });
    }

    public function test_no_line_token_sends_nothing_and_does_not_error(): void
    {
        $this->setToken(null);
        $booking = $this->bookingFor($this->customer(withLine: true));

        $this->approvePaymentFor($booking);

        Http::assertNothingSent();
    }

    public function test_a_customer_without_a_linked_line_gets_no_push(): void
    {
        $this->setToken('test-token');
        $booking = $this->bookingFor($this->customer(withLine: false));

        $this->approvePaymentFor($booking);

        Http::assertNothingSent();
    }

    public function test_a_disabled_template_is_not_sent(): void
    {
        $this->setToken('test-token');
        LineMessageTemplate::create([
            'organization_id' => $this->org()->id,
            'event' => 'booking_confirmed',
            'enabled' => false,
        ]);
        $booking = $this->bookingFor($this->customer(withLine: true));

        $this->approvePaymentFor($booking);

        // booking_confirmed is off; payment_received is off by default → silence.
        Http::assertNothingSent();
    }

    public function test_cancelling_a_booking_pushes_the_cancellation_card(): void
    {
        $this->setToken('test-token');
        $booking = $this->bookingFor($this->customer(withLine: true));

        app(NotificationService::class)->bookingCancelled($booking->fresh());

        Http::assertSent(fn ($request) => str_contains($request->url(), '/message/push')
            && str_contains(json_encode($request->data(), JSON_UNESCAPED_UNICODE), 'ยกเลิก'));
    }
}
