<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Check-in at the counter.
 *
 * The old flow was a decorative QR nobody could scan and a button on the
 * customer's own screen that marked their booking complete. These are the
 * assertions that keep the real one honest — especially that every refusal
 * tells the staff member something they can say out loud.
 */
class OwnerCheckinTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function as(string $token): self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    private function login(string $email): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => $email,
            'password' => 'password',
        ])->json('token');
    }

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    /** The venue's clock. Booking times are its wall clock, not the app's UTC. */
    private function venueNow(): Carbon
    {
        return now()->timezone($this->venueTimezone());
    }

    private function venueTimezone(): string
    {
        return $this->org()->settings?->timezone ?: 'Asia/Bangkok';
    }

    /** A confirmed booking happening right now, so the window is open. */
    private function bookingNow(array $overrides = []): Booking
    {
        $org = $this->org();
        $court = $org->courts()->firstOrFail();
        $local = $this->venueNow();

        return Booking::create(array_merge([
            'organization_id' => $org->id,
            'branch_id' => $court->branch_id,
            'court_id' => $court->id,
            'customer_id' => \App\Models\Customer::query()->forOrganization($org->id)->firstOrFail()->id,
            'code' => 'BKCHECKIN'.random_int(1000, 9999),
            'date' => $local->toDateString(),
            'start' => $local->copy()->subMinutes(10)->format('H:i'),
            'end' => $local->copy()->addHour()->format('H:i'),
            'amount' => 300,
            'status' => 'confirmed',
            'channel' => 'application',
        ], $overrides));
    }

    public function test_every_booking_is_issued_a_check_in_token(): void
    {
        $booking = $this->bookingNow();

        $this->assertNotNull($booking->checkin_token);
        $this->assertSame(32, strlen($booking->checkin_token));
        // Not the booking code: that is short enough to guess, and a guessed
        // one would check in a stranger.
        $this->assertNotSame($booking->code, $booking->checkin_token);
    }

    public function test_staff_can_check_a_customer_in_by_scanning_the_token(): void
    {
        $booking = $this->bookingNow();

        $this->as($this->login('owner@everyday.test'))
            ->postJson('/api/v1/owner/checkin', ['token' => $booking->checkin_token])
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('code', 'checked_in')
            ->assertJsonPath('booking.code', $booking->code);

        $this->assertNotNull($booking->fresh()->checked_in_at);
        $this->assertSame('completed', $booking->fresh()->status);
    }

    /** Typing the code off the customer's screen is the no-camera fallback. */
    public function test_the_booking_code_works_as_well_as_the_token(): void
    {
        $booking = $this->bookingNow();

        $this->as($this->login('owner@everyday.test'))
            ->postJson('/api/v1/owner/checkin', ['token' => strtolower($booking->code)])
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertNotNull($booking->fresh()->checked_in_at);
    }

    /** Scanning twice is a normal thing to do, not an error. */
    public function test_a_second_scan_reports_the_first_one_instead_of_failing(): void
    {
        $booking = $this->bookingNow();
        $token = $this->login('owner@everyday.test');

        $this->as($token)->postJson('/api/v1/owner/checkin', ['token' => $booking->checkin_token])->assertOk();
        $first = $booking->fresh()->checked_in_at;

        $this->as($token)->postJson('/api/v1/owner/checkin', ['token' => $booking->checkin_token])
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('code', 'already');

        // The original time is kept — a re-scan must not rewrite when they came.
        $this->assertEquals($first->toIso8601String(), $booking->fresh()->checked_in_at->toIso8601String());
    }

    public function test_an_unpaid_booking_is_refused_with_a_reason(): void
    {
        $booking = $this->bookingNow(['status' => 'pending_payment']);

        $this->as($this->login('owner@everyday.test'))
            ->postJson('/api/v1/owner/checkin', ['token' => $booking->checkin_token])
            ->assertOk()
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'unpaid');

        $this->assertNull($booking->fresh()->checked_in_at);
    }

    public function test_a_cancelled_booking_is_refused(): void
    {
        $booking = $this->bookingNow(['status' => 'cancelled']);

        $this->as($this->login('owner@everyday.test'))
            ->postJson('/api/v1/owner/checkin', ['token' => $booking->checkin_token])
            ->assertOk()
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'cancelled');
    }

    /** Someone arriving days early gets told when to come back. */
    public function test_a_booking_for_another_day_is_refused_as_too_early(): void
    {
        $booking = $this->bookingNow([
            'date' => $this->venueNow()->addDays(3)->toDateString(),
            'start' => '10:00',
            'end' => '11:00',
        ]);

        $response = $this->as($this->login('owner@everyday.test'))
            ->postJson('/api/v1/owner/checkin', ['token' => $booking->checkin_token])
            ->assertOk()
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'too_early');

        // The message has to carry the date, or the staff member cannot act on it.
        $this->assertStringContainsString('10:00', $response->json('message'));
    }

    public function test_a_slot_that_finished_hours_ago_is_refused(): void
    {
        // 20:00 at the venue, for a slot that ended at 09:00 there.
        Carbon::setTestNow(now()->timezone('Asia/Bangkok')->setTime(20, 0));

        $booking = $this->bookingNow(['start' => '08:00', 'end' => '09:00']);

        $this->as($this->login('owner@everyday.test'))
            ->postJson('/api/v1/owner/checkin', ['token' => $booking->checkin_token])
            ->assertOk()
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'expired');

        Carbon::setTestNow();
    }

    /**
     * The app runs on UTC; a booking's "18:00" is 18:00 at the counter.
     *
     * Comparing the two without converting is seven hours out in Thailand, and
     * every afternoon arrival was refused as "ยังไม่ถึงเวลา". Pinned to a real
     * afternoon so the bug cannot come back unnoticed.
     */
    public function test_the_window_is_measured_on_the_venue_clock_not_utc(): void
    {
        // 15:30 in Bangkok = 08:30 UTC.
        Carbon::setTestNow(Carbon::parse('2026-08-02 15:30', 'Asia/Bangkok'));

        $booking = $this->bookingNow(['date' => '2026-08-02', 'start' => '15:00', 'end' => '16:00']);

        $this->as($this->login('owner@everyday.test'))
            ->postJson('/api/v1/owner/checkin', ['token' => $booking->checkin_token])
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('code', 'checked_in');

        Carbon::setTestNow();
    }

    /** A token from another venue must simply not exist here. */
    public function test_a_token_from_another_venue_is_not_found(): void
    {
        $other = Organization::where('slug', '!=', 'everyday-badminton')->firstOrFail();
        $court = $other->courts()->first();
        $this->assertNotNull($court, 'seeded second org needs a court');

        $theirCustomer = \App\Models\Customer::query()->forOrganization($other->id)->first()
            ?? \App\Models\Customer::create([
                'organization_id' => $other->id,
                'display_name' => 'ลูกค้าสนามอื่น',
                'total_spending' => 0,
                'visits' => 0,
            ]);

        $theirs = Booking::create([
            'organization_id' => $other->id,
            'branch_id' => $court->branch_id,
            'court_id' => $court->id,
            'customer_id' => $theirCustomer->id,
            'code' => 'BKOTHER123',
            'date' => $this->venueNow()->toDateString(),
            'start' => $this->venueNow()->subMinutes(10)->format('H:i'),
            'end' => $this->venueNow()->addHour()->format('H:i'),
            'amount' => 300,
            'status' => 'confirmed',
            'channel' => 'application',
        ]);

        $this->as($this->login('owner@everyday.test'))
            ->postJson('/api/v1/owner/checkin', ['token' => $theirs->checkin_token])
            ->assertNotFound()
            ->assertJsonPath('code', 'not_found');

        $this->assertNull($theirs->fresh()->checked_in_at);
    }

    /** The customer may hold the token, but must not be able to use it. */
    public function test_a_customer_cannot_check_themselves_in(): void
    {
        $booking = $this->bookingNow();

        $this->app['auth']->forgetGuards();
        $customerToken = $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => 'Uselfcheckin',
            'displayName' => 'อยากเช็คอินเอง',
        ])->json('token');

        // The old self-service route is gone entirely.
        $this->as($customerToken)
            ->postJson("/api/v1/bookings/{$booking->id}/checkin")
            ->assertNotFound();

        // …and the owner endpoint is not theirs to call.
        $this->as($customerToken)
            ->postJson('/api/v1/owner/checkin', ['token' => $booking->checkin_token])
            ->assertForbidden();

        $this->assertNull($booking->fresh()->checked_in_at);
    }

    /** Checking people in is a front-desk job, gated like every other action. */
    public function test_a_role_without_the_permission_cannot_check_anyone_in(): void
    {
        $booking = $this->bookingNow();
        $org = $this->org();

        $user = User::create([
            'name' => 'Marketing Person',
            'display_name' => 'Marketing Person',
            'email' => 'marketing-checkin@everyday.test',
            'password' => 'password',
        ]);
        OrganizationUser::create([
            'organization_id' => $org->id,
            'user_id' => $user->id,
            'role_id' => Role::where('code', 'marketing')->value('id'),
            'display_name' => $user->display_name,
            'status' => 'active',
            'joined_at' => now(),
        ]);

        $this->as($this->login($user->email))
            ->postJson('/api/v1/owner/checkin', ['token' => $booking->checkin_token])
            ->assertForbidden();

        // Reception is exactly the role that should be able to.
        $reception = User::create([
            'name' => 'Reception Person',
            'display_name' => 'Reception Person',
            'email' => 'reception-checkin@everyday.test',
            'password' => 'password',
        ]);
        OrganizationUser::create([
            'organization_id' => $org->id,
            'user_id' => $reception->id,
            'role_id' => Role::where('code', 'reception')->value('id'),
            'display_name' => $reception->display_name,
            'status' => 'active',
            'joined_at' => now(),
        ]);

        $this->as($this->login($reception->email))
            ->postJson('/api/v1/owner/checkin', ['token' => $booking->checkin_token])
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    public function test_recent_arrivals_lists_who_has_checked_in(): void
    {
        $booking = $this->bookingNow();
        $token = $this->login('owner@everyday.test');

        $this->as($token)->postJson('/api/v1/owner/checkin', ['token' => $booking->checkin_token])->assertOk();

        $this->as($token)->getJson('/api/v1/owner/checkin/recent')
            ->assertOk()
            ->assertJsonPath('data.0.code', $booking->code)
            ->assertJsonStructure(['data' => [['id', 'code', 'customerName', 'courtName', 'checkedInAt']]]);
    }

    /** A venue that does not scan should not show its customers a QR. */
    public function test_a_venue_can_turn_check_in_off(): void
    {
        $this->as($this->login('owner@everyday.test'))
            ->putJson('/api/v1/owner/settings', ['checkinEnabled' => false])
            ->assertOk()
            ->assertJsonPath('data.checkinEnabled', false);

        $this->getJson('/api/v1/orgs/everyday-badminton/public')
            ->assertOk()
            ->assertJsonPath('checkinEnabled', false);

        $this->as($this->login('owner@everyday.test'))
            ->putJson('/api/v1/owner/settings', ['checkinEnabled' => true])
            ->assertOk();

        $this->getJson('/api/v1/orgs/everyday-badminton/public')
            ->assertJsonPath('checkinEnabled', true);
    }
}
