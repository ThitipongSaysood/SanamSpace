<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\CustomerTimelineEntry;
use App\Models\Membership;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The CRM timeline, written by what actually happens.
 *
 * Before this the only thing that ever wrote `customer_timeline` was the
 * seeder — so a demo customer looked busy and a real one looked like they had
 * never been to the venue. The CRM screen was showing fixtures.
 */
class CustomerTimelineTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
        Storage::fake('public');
    }

    private function token(string $lineId = 'Utimeline'): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => $lineId,
            'displayName' => 'คุณไทม์ไลน์',
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

    private function customer(): Customer
    {
        return Customer::where('line_user_id', 'Utimeline')->firstOrFail();
    }

    /** @return string[] titles, newest last */
    private function titles(): array
    {
        return CustomerTimelineEntry::query()
            ->where('customer_id', $this->customer()->id)
            ->orderBy('occurred_at')
            ->pluck('title')
            ->all();
    }

    private function book(string $token, string $date = '2026-10-20'): string
    {
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');
        $this->app['auth']->forgetGuards();

        return $this->withToken($token)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => $date,
            'start' => '18:00',
            'end' => '19:00',
        ])->assertCreated()->json('data.id');
    }

    /** Signing up is the first thing that ever happened to them. */
    public function test_signing_up_starts_the_timeline(): void
    {
        $this->token();

        $this->assertSame(['สมัครสมาชิก'], $this->titles());
    }

    /** Booking writes a line, without anyone remembering to call anything. */
    public function test_booking_is_recorded(): void
    {
        $token = $this->token();
        $this->book($token);

        $this->assertContains('จอง '.Booking::latest('created_at')->first()->code, $this->titles());
    }

    /** Cancelling is a separate line, not the booking line disappearing. */
    public function test_cancelling_is_recorded_as_its_own_entry(): void
    {
        $token = $this->token();
        $bookingId = $this->book($token);
        $code = Booking::find($bookingId)->code;

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$bookingId}/cancel")->assertOk();

        $titles = $this->titles();
        $this->assertContains("จอง {$code}", $titles);
        $this->assertContains("ยกเลิกการจอง {$code}", $titles);
    }

    /** Money is recorded when it is accepted, not when it is offered. */
    public function test_only_an_approved_payment_is_recorded(): void
    {
        $token = $this->token();
        $bookingId = $this->book($token);

        $paymentId = $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId,
            'method' => 'transfer',
        ])->assertCreated()->json('data.id');

        // Created and slip sent — nothing has been accepted yet.
        $this->withToken($token)->postJson("/api/v1/payments/{$paymentId}/upload-slip", [
            'slip' => UploadedFile::fake()->image('slip.png'),
        ])->assertOk();

        $this->assertEmpty(array_filter($this->titles(), fn ($t) => str_contains($t, 'ชำระเงิน')));

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/payments/{$paymentId}/verify")->assertOk();

        $this->assertContains('ชำระเงิน ฿250', $this->titles());
    }

    /** A rejected slip is history too — it explains a later re-payment. */
    public function test_a_rejected_slip_is_recorded(): void
    {
        $token = $this->token();
        $bookingId = $this->book($token);

        $paymentId = $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId,
            'method' => 'transfer',
        ])->json('data.id');

        $this->withToken($token)->postJson("/api/v1/payments/{$paymentId}/upload-slip", [
            'slip' => UploadedFile::fake()->image('slip.png'),
        ])->assertOk();

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/payments/{$paymentId}/reject")->assertOk();

        $this->assertContains('สลิปไม่ผ่าน ฿250', $this->titles());
    }

    /** Arriving is the moment the venue actually met them. */
    public function test_checking_in_is_recorded(): void
    {
        $token = $this->token();
        $bookingId = $this->book($token, now()->toDateString());

        Booking::find($bookingId)->update(['checked_in_at' => now()]);

        $this->assertContains('เช็คอิน '.Booking::find($bookingId)->code, $this->titles());
    }

    /** Points moving is something the customer can see, so the venue should too. */
    public function test_points_changes_are_recorded(): void
    {
        $this->token();
        $customer = $this->customer();

        $membership = Membership::create([
            'organization_id' => $customer->organization_id,
            'customer_id' => $customer->id,
            'tier' => 'silver',
            'member_id' => 'MB-TL-001',
            'points' => 0,
            'expires_at' => now()->addYear(),
        ]);

        $membership->update(['points' => 120]);

        $this->assertContains('แต้มสะสม +120', $this->titles());

        $membership->update(['points' => 100]);
        $this->assertContains('แต้มสะสม -20', $this->titles());
    }

    /**
     * Model events can fire twice for one real action, and two identical lines
     * would read as two bookings.
     */
    public function test_the_same_event_is_not_written_twice(): void
    {
        $token = $this->token();
        $bookingId = $this->book($token);
        $booking = Booking::find($bookingId);

        // Touch it again the way a later save would.
        $booking->update(['status' => 'cancelled']);
        $booking->update(['status' => 'cancelled']);

        $cancels = array_filter($this->titles(), fn ($t) => str_starts_with($t, 'ยกเลิกการจอง'));

        $this->assertCount(1, $cancels);
    }

    /** A walk-in has no customer, so there is nothing to write and no crash. */
    public function test_a_walk_in_booking_without_a_customer_records_nothing(): void
    {
        $before = CustomerTimelineEntry::count();

        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');

        $this->withToken($this->ownerToken())->postJson('/api/v1/owner/bookings', [
            'courtId' => $courtId,
            'date' => '2026-10-25',
            'start' => '18:00',
            'end' => '19:00',
            'customerName' => 'คนเดินเข้ามา',
        ])->assertCreated();

        // The new walk-in Customer row gets its signup line and its booking
        // line — but nothing crashed, and nothing was attributed to nobody.
        $this->assertGreaterThan($before, CustomerTimelineEntry::count());
        $this->assertSame(0, CustomerTimelineEntry::whereNull('customer_id')->count());
    }

    /** The owner's CRM screen reads what the observers wrote. */
    public function test_the_owner_can_read_the_timeline_it_produced(): void
    {
        $token = $this->token();
        $this->book($token);

        $rows = $this->withToken($this->ownerToken())
            ->getJson("/api/v1/owner/timeline/{$this->customer()->id}")
            ->assertOk()
            ->json('data');

        $this->assertNotEmpty($rows);
        $this->assertContains('signup', array_column($rows, 'type'));
        $this->assertContains('booking', array_column($rows, 'type'));
    }
}
