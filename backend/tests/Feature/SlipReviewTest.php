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
 * Who may accept money, and what a booking's state says about it.
 *
 * Two problems live here. The first is an authorisation hole: approving a slip
 * sat on the customer route table, unscoped, so a signed-in customer could
 * confirm their own booking without transferring anything — and could decide
 * any other venue's payment by id. The second is bookkeeping: a slip whose
 * booking was cancelled stayed in the venue's review queue, and approving it
 * quietly un-cancelled the booking.
 */
class SlipReviewTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
        Storage::fake('public');
    }

    private function customerToken(string $lineUserId = 'Uslip'): string
    {
        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => $lineUserId,
            'displayName' => 'ลูกค้าสลิป',
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

    /** Book, pay, upload a slip. Returns [bookingId, paymentId]. */
    private function bookAndSendSlip(string $token, string $date = '2026-12-01'): array
    {
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');

        $bookingId = $this->withToken($token)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => $date,
            'start' => '18:00',
            'end' => '19:00',
        ])->assertCreated()->json('data.id');

        $paymentId = $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId,
            'method' => 'transfer',
        ])->assertCreated()->json('data.id');

        $this->withToken($token)->postJson("/api/v1/payments/{$paymentId}/upload-slip", [
            'slip' => UploadedFile::fake()->image('slip.png'),
        ])->assertOk();

        return [$bookingId, $paymentId];
    }

    // ---- The hole -------------------------------------------------------

    /**
     * The one that mattered: a customer could book a court, call verify with
     * their own token, and walk in on a confirmed booking having paid nothing.
     */
    public function test_a_customer_cannot_approve_their_own_payment(): void
    {
        $token = $this->customerToken();
        [$bookingId, $paymentId] = $this->bookAndSendSlip($token);

        $this->withToken($token)->postJson("/api/v1/payments/{$paymentId}/verify")
            ->assertNotFound();

        $this->assertSame('pending_review', Payment::find($paymentId)->status);
        $this->assertSame('pending_payment', Booking::find($bookingId)->status);
    }

    /** The same route let a customer reject a stranger's slip by id. */
    public function test_a_customer_cannot_reject_a_payment(): void
    {
        $token = $this->customerToken();
        [, $paymentId] = $this->bookAndSendSlip($token);

        $this->withToken($token)->postJson("/api/v1/payments/{$paymentId}/reject")
            ->assertNotFound();

        $this->assertSame('pending_review', Payment::find($paymentId)->status);
    }

    // ---- Deciding a slip ------------------------------------------------

    /** The venue's own route still works, and confirms the booking. */
    public function test_staff_approval_confirms_the_booking(): void
    {
        $token = $this->customerToken();
        [$bookingId, $paymentId] = $this->bookAndSendSlip($token);

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/payments/{$paymentId}/verify")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->assertSame('confirmed', Booking::find($bookingId)->status);
    }

    /**
     * Two staff working the queue on two phones tap อนุมัติ on the same row.
     * The second tap must not re-approve and send a second receipt.
     */
    public function test_a_slip_can_only_be_decided_once(): void
    {
        $token = $this->customerToken();
        [, $paymentId] = $this->bookAndSendSlip($token);
        $owner = $this->ownerToken();

        $this->withToken($owner)->postJson("/api/v1/owner/payments/{$paymentId}/verify")->assertOk();

        $this->withToken($owner)->postJson("/api/v1/owner/payments/{$paymentId}/verify")
            ->assertStatus(422);

        $this->withToken($owner)->postJson("/api/v1/owner/payments/{$paymentId}/reject")
            ->assertStatus(422);

        $this->assertSame('approved', Payment::find($paymentId)->status);
    }

    /** Approving money against a cancelled slot would put the court back. */
    public function test_a_cancelled_bookings_slip_cannot_be_approved(): void
    {
        $token = $this->customerToken();
        [$bookingId, $paymentId] = $this->bookAndSendSlip($token);

        $this->withToken($token)->postJson("/api/v1/bookings/{$bookingId}/cancel")->assertOk();

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/payments/{$paymentId}/verify")
            ->assertStatus(422);

        $this->assertSame('cancelled', Booking::find($bookingId)->status);
    }

    /**
     * The same guard, for rows that predate the fix.
     *
     * Bookings cancelled before this shipped still have a live pending_review
     * payment attached. Approving one is the case that used to un-cancel the
     * booking, so the check must not rely on the payment having been closed.
     */
    public function test_a_legacy_slip_on_a_cancelled_booking_is_refused(): void
    {
        $token = $this->customerToken();
        [$bookingId, $paymentId] = $this->bookAndSendSlip($token);

        // Cancel the way the old code did: booking only, slip left open.
        Booking::find($bookingId)->update(['status' => 'cancelled']);
        $this->assertSame('pending_review', Payment::find($paymentId)->status);

        $owner = $this->ownerToken();

        $this->withToken($owner)->postJson("/api/v1/owner/payments/{$paymentId}/verify")
            ->assertStatus(422);

        $this->assertSame('cancelled', Booking::find($bookingId)->status);

        // And it is not offered as work in the first place.
        $queue = $this->withToken($owner)->getJson('/api/v1/owner/payments?status=pending_review')
            ->assertOk()->json('data');

        $this->assertNotContains($paymentId, array_column($queue, 'id'));
    }

    /** A booking already played out must not walk backwards to confirmed. */
    public function test_approving_late_does_not_un_complete_a_booking(): void
    {
        $token = $this->customerToken();
        [$bookingId, $paymentId] = $this->bookAndSendSlip($token);

        Booking::find($bookingId)->update(['status' => 'completed']);

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/payments/{$paymentId}/verify")
            ->assertOk();

        $this->assertSame('completed', Booking::find($bookingId)->status);
        $this->assertSame('approved', Payment::find($paymentId)->status);
    }

    // ---- The queue ------------------------------------------------------

    /** Cancelling closes the slip, so it stops being work for the venue. */
    public function test_cancelling_a_booking_takes_its_slip_out_of_the_queue(): void
    {
        $token = $this->customerToken();
        [$bookingId, $paymentId] = $this->bookAndSendSlip($token);
        $owner = $this->ownerToken();

        $this->withToken($owner)->getJson('/api/v1/owner/payments?status=pending_review')
            ->assertOk()
            ->assertJsonFragment(['id' => $paymentId]);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$bookingId}/cancel")->assertOk();
        $this->app['auth']->forgetGuards();

        $this->assertSame('cancelled', Payment::find($paymentId)->status);

        $queue = $this->withToken($owner)->getJson('/api/v1/owner/payments?status=pending_review')
            ->assertOk()->json('data');

        $this->assertNotContains($paymentId, array_column($queue, 'id'));
    }

    /** Deleting a booking must not leave a nameless slip behind either. */
    public function test_deleting_a_booking_closes_its_open_slip(): void
    {
        $token = $this->customerToken();
        [$bookingId, $paymentId] = $this->bookAndSendSlip($token);

        $this->withToken($this->ownerToken())
            ->deleteJson("/api/v1/owner/bookings/{$bookingId}")
            ->assertNoContent();

        $this->assertSame('cancelled', Payment::find($paymentId)->status);
    }

    // ---- What the owner list can tell apart ------------------------------

    /**
     * The reported symptom: staff open รายการจอง and every unpaid booking reads
     * "รอชำระเงิน", including the ones whose slip is already in their own queue.
     * The list needs the payment status to tell those apart.
     */
    public function test_the_owner_booking_list_carries_the_payment_status(): void
    {
        $token = $this->customerToken();
        [$bookingId] = $this->bookAndSendSlip($token);

        $rows = $this->withToken($this->ownerToken())
            ->getJson('/api/v1/owner/bookings?perPage=200')
            ->assertOk()
            ->json('data');

        $row = collect($rows)->firstWhere('id', $bookingId);

        $this->assertNotNull($row, 'the booking should be in the owner list');
        $this->assertSame('pending_payment', $row['status']);
        $this->assertSame('pending_review', $row['paymentStatus']);
    }

    /**
     * The slip travels with the booking, so it can be decided in place.
     *
     * The detail panel used to send staff to another screen to find the same
     * row again; it needs the image itself to be worth opening.
     */
    public function test_the_booking_detail_carries_the_slip_itself(): void
    {
        $token = $this->customerToken();
        [$bookingId, $paymentId] = $this->bookAndSendSlip($token);

        $row = $this->withToken($this->ownerToken())
            ->getJson("/api/v1/owner/bookings/{$bookingId}")
            ->assertOk()
            ->json('data');

        $this->assertSame($paymentId, $row['paymentId']);
        $this->assertSame('pending_review', $row['paymentStatus']);
        $this->assertSame('transfer', $row['paymentMethod']);
        $this->assertStringStartsWith('http', $row['paymentSlipUrl']);
    }

    /**
     * Deciding from the booking panel is the same gated action as the queue.
     *
     * A cashier legitimately holds payment.verify — checking slips is counter
     * work. A viewer does not, and the new buttons must not become a way round
     * that just because they sit on a different screen.
     */
    public function test_a_viewer_cannot_approve_from_the_booking_panel(): void
    {
        $token = $this->customerToken();
        [, $paymentId] = $this->bookAndSendSlip($token);

        $org = \App\Models\Organization::where('slug', 'everyday-badminton')->firstOrFail();
        $user = \App\Models\User::create([
            'name' => 'Viewer',
            'display_name' => 'Viewer',
            'email' => 'slip-viewer@everyday.test',
            'password' => 'password',
        ]);
        \App\Models\OrganizationUser::create([
            'organization_id' => $org->id,
            'user_id' => $user->id,
            'role_id' => \App\Models\Role::where('code', 'viewer')->value('id'),
            'display_name' => $user->display_name,
            'status' => 'active',
            'joined_at' => now(),
        ]);

        $this->app['auth']->forgetGuards();
        $viewer = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'slip-viewer@everyday.test',
            'password' => 'password',
        ])->json('token');

        $this->app['auth']->forgetGuards();
        $this->withToken($viewer)->postJson("/api/v1/owner/payments/{$paymentId}/verify")
            ->assertForbidden();

        $this->assertSame('pending_review', Payment::find($paymentId)->status);
    }

    /** And a booking nobody has paid for still reads as nothing owed yet. */
    public function test_an_untouched_booking_reports_no_payment(): void
    {
        $token = $this->customerToken();
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');

        $bookingId = $this->withToken($token)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => '2026-12-02',
            'start' => '18:00',
            'end' => '19:00',
        ])->assertCreated()->json('data.id');

        $row = $this->withToken($this->ownerToken())
            ->getJson("/api/v1/owner/bookings/{$bookingId}")
            ->assertOk()
            ->json('data');

        $this->assertNull($row['paymentStatus']);
    }
}
