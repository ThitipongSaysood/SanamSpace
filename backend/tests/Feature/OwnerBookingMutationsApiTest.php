<?php

namespace Tests\Feature;

use App\Models\Court;
use App\Models\Organization;
use App\Models\Booking;
use App\Models\Customer;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Owner Portal — booking scheduler mutations: create (walk-in / existing
 * customer), reschedule/edit, cancel, with overlap protection. Org-scoped.
 */
class OwnerBookingMutationsApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function ownerToken(): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');
    }

    private function courtId(): string
    {
        $org = Organization::where('slug', 'everyday-badminton')->firstOrFail();

        return Court::where('organization_id', $org->id)->firstOrFail()->id;
    }

    public function test_owner_creates_a_walkin_booking(): void
    {
        $res = $this->withToken($this->ownerToken())->postJson('/api/v1/owner/bookings', [
            'courtId' => $this->courtId(),
            'date' => '2026-07-01',
            'start' => '14:00',
            'end' => '16:00',
            'customerName' => 'คุณวอล์คอิน',
        ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'confirmed')
            ->assertJsonPath('data.start', '14:00')
            ->assertJsonPath('data.end', '16:00');

        $this->assertGreaterThan(0, $res->json('data.amount'));
        $this->assertDatabaseHas('customers', ['display_name' => 'คุณวอล์คอิน']);
    }

    public function test_overlapping_booking_is_rejected(): void
    {
        $court = $this->courtId();
        $token = $this->ownerToken();

        $this->withToken($token)->postJson('/api/v1/owner/bookings', [
            'courtId' => $court,
            'date' => '2026-07-02',
            'start' => '10:00',
            'end' => '12:00',
            'customerName' => 'A',
        ])->assertCreated();

        $this->withToken($token)->postJson('/api/v1/owner/bookings', [
            'courtId' => $court,
            'date' => '2026-07-02',
            'start' => '11:00',
            'end' => '13:00',
            'customerName' => 'B',
        ])->assertStatus(422);
    }

    /**
     * The counter (owner) and the customer app write to the same bookings table
     * and must share one overlap guard + lock key — a walk-in cannot be taken on
     * a slot the app already booked, in either order.
     */
    public function test_counter_and_app_cannot_double_book_the_same_slot(): void
    {
        $court = $this->courtId();

        $customerToken = $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => 'Uoverlap',
            'displayName' => 'Overlap Tester',
        ])->json('token');

        // App books 18:00–19:00.
        $this->withToken($customerToken)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $court,
            'date' => '2026-07-10',
            'start' => '18:00',
            'end' => '19:00',
        ])->assertCreated();

        // Counter tries an overlapping 18:30–19:30 walk-in → refused.
        $this->app['auth']->forgetGuards();
        $this->withToken($this->ownerToken())->postJson('/api/v1/owner/bookings', [
            'courtId' => $court,
            'date' => '2026-07-10',
            'start' => '18:30',
            'end' => '19:30',
            'customerName' => 'Walk-in',
        ])->assertStatus(422)->assertJsonValidationErrors('start');

        // Reverse: counter takes a fresh slot, the app cannot overlap it.
        $this->app['auth']->forgetGuards();
        $this->withToken($this->ownerToken())->postJson('/api/v1/owner/bookings', [
            'courtId' => $court,
            'date' => '2026-07-11',
            'start' => '20:00',
            'end' => '21:00',
            'customerName' => 'Counter',
        ])->assertCreated();

        $this->app['auth']->forgetGuards();
        $this->withToken($customerToken)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $court,
            'date' => '2026-07-11',
            'start' => '20:00',
            'end' => '21:00',
        ])->assertStatus(422);
    }

    /**
     * The calendar's date window must return EVERY booking it covers, not one
     * page — a busy month has more than the 50/200 page cap, and paginating it
     * left whole days blank in the month view while the day view had them.
     */
    public function test_a_date_ranged_query_returns_all_bookings_past_the_page_cap(): void
    {
        $org = Organization::where('slug', 'everyday-badminton')->firstOrFail();
        $court = Court::where('organization_id', $org->id)->firstOrFail();

        // 60 bookings on 60 distinct dates — more than the default 50 page.
        for ($i = 0; $i < 60; $i++) {
            $date = now()->addDays($i)->toDateString();
            Booking::create([
                'organization_id' => $org->id,
                'branch_id' => $court->branch_id,
                'court_id' => $court->id,
                'customer_id' => Customer::where('organization_id', $org->id)->value('id'),
                'code' => 'BKR'.str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                'date' => $date,
                'start' => '10:00',
                'end' => '11:00',
                'amount' => 250,
                'status' => 'confirmed',
            ]);
        }

        $from = now()->toDateString();
        $to = now()->addDays(70)->toDateString();

        $data = $this->withToken($this->ownerToken())
            ->getJson("/api/v1/owner/bookings?from={$from}&to={$to}")
            ->assertOk()
            ->json('data');

        $this->assertCount(60, $data, 'the calendar window must return every booking, not one page');
        // Ordered by date for the grid.
        $this->assertLessThanOrEqual($data[count($data) - 1]['date'], $data[0]['date']);
    }

    public function test_cancelling_a_booking_releases_the_slot_for_a_new_one(): void
    {
        $court = $this->courtId();
        $token = $this->ownerToken();

        $slot = ['courtId' => $court, 'date' => '2026-07-20', 'start' => '18:00', 'end' => '19:00'];

        $id = $this->withToken($token)->postJson('/api/v1/owner/bookings', $slot + ['customerName' => 'คนแรก'])
            ->assertCreated()->json('data.id');

        // Same slot is refused while the booking stands.
        $this->withToken($token)->postJson('/api/v1/owner/bookings', $slot + ['customerName' => 'คนซ้ำ'])
            ->assertStatus(422);

        // Cancel it → the slot is free again.
        $this->withToken($token)->postJson("/api/v1/owner/bookings/{$id}/cancel")->assertOk();

        $this->withToken($token)->postJson('/api/v1/owner/bookings', $slot + ['customerName' => 'คนใหม่'])
            ->assertCreated();
    }

    public function test_owner_can_reschedule_and_cancel(): void
    {
        $token = $this->ownerToken();

        $id = $this->withToken($token)->postJson('/api/v1/owner/bookings', [
            'courtId' => $this->courtId(),
            'date' => '2026-07-03',
            'start' => '09:00',
            'end' => '10:00',
            'customerName' => 'มูฟ',
        ])->json('data.id');

        $this->withToken($token)->putJson("/api/v1/owner/bookings/$id", [
            'start' => '18:00',
            'end' => '20:00',
        ])
            ->assertOk()
            ->assertJsonPath('data.start', '18:00')
            ->assertJsonPath('data.end', '20:00');

        $this->withToken($token)->postJson("/api/v1/owner/bookings/$id/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');
    }

    /** Delete is for a mistake at the counter, not for a no-show. */
    public function test_owner_can_delete_a_booking_that_took_no_money(): void
    {
        $token = $this->ownerToken();

        $id = $this->withToken($token)->postJson('/api/v1/owner/bookings', [
            'courtId' => $this->courtId(),
            'date' => '2026-09-14',
            'start' => '10:00',
            'end' => '11:00',
            'customerName' => 'พิมพ์ผิด',
        ])->assertCreated()->json('data.id');

        $this->withToken($token)->deleteJson("/api/v1/owner/bookings/{$id}")->assertNoContent();

        $this->withToken($token)->getJson("/api/v1/owner/bookings/{$id}")->assertNotFound();
        // Soft-deleted, so the wrong row can be recovered if it mattered.
        $this->assertSoftDeleted('bookings', ['id' => $id]);
    }

    /**
     * A booking with an approved payment is a financial record. The way out of
     * one is cancel-and-refund, not making the row disappear.
     */
    public function test_a_paid_booking_cannot_be_deleted(): void
    {
        $token = $this->ownerToken();

        $id = $this->withToken($token)->postJson('/api/v1/owner/bookings', [
            'courtId' => $this->courtId(),
            'date' => '2026-09-15',
            'start' => '10:00',
            'end' => '11:00',
            'customerName' => 'จ่ายแล้ว',
        ])->assertCreated()->json('data.id');

        $booking = \App\Models\Booking::findOrFail($id);
        \App\Models\Payment::create([
            'organization_id' => $booking->organization_id,
            'booking_id' => $booking->id,
            'customer_id' => $booking->customer_id,
            'method' => 'transfer',
            'amount' => $booking->amount,
            'status' => 'approved',
        ]);

        $this->withToken($token)->deleteJson("/api/v1/owner/bookings/{$id}")
            ->assertStatus(422)
            ->assertJsonValidationErrors('id');

        $this->assertDatabaseHas('bookings', ['id' => $id, 'deleted_at' => null]);
    }

    /** Another venue's booking is not there to delete. */
    public function test_deleting_another_venues_booking_is_not_found(): void
    {
        $other = Organization::where('slug', '!=', 'everyday-badminton')->firstOrFail();
        $court = $other->courts()->firstOrFail();
        $customer = Customer::query()->forOrganization($other->id)->first()
            ?? Customer::create(['organization_id' => $other->id, 'display_name' => 'ลูกค้าสนามอื่น']);

        $theirs = Booking::create([
            'organization_id' => $other->id,
            'branch_id' => $court->branch_id,
            'court_id' => $court->id,
            'customer_id' => $customer->id,
            'code' => 'BKOTHERDEL',
            'date' => '2026-09-16',
            'start' => '10:00',
            'end' => '11:00',
            'amount' => 300,
            'status' => 'confirmed',
            'channel' => 'walk_in',
        ]);

        $this->withToken($this->ownerToken())
            ->deleteJson("/api/v1/owner/bookings/{$theirs->id}")
            ->assertNotFound();

        $this->assertDatabaseHas('bookings', ['id' => $theirs->id, 'deleted_at' => null]);
    }

    public function test_super_admin_cannot_create_booking(): void
    {
        $token = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'super@sanamspace.test',
            'password' => 'password',
        ])->json('token');

        $this->withToken($token)->postJson('/api/v1/owner/bookings', [])->assertForbidden();
    }
}
