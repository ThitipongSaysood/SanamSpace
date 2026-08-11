<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Court;
use App\Models\Customer;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Role;
use App\Models\User;
use App\Support\VenueClock;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * The floor, right now.
 *
 * Almost everything here is really one assertion in different clothes: the
 * board must agree with the clock on the wall. The app runs in UTC and bookings
 * hold the venue's wall-clock times, so a board built on the server's own clock
 * would be seven hours wrong in Bangkok — showing the breakfast bookings as
 * in-play through the afternoon.
 */
class CourtBoardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
        // Every test here places a booking at an offset from "now".
        $this->freezeVenueClockAtMidday($this->org()->id);
    }

    public function test_a_court_being_played_on_says_who_is_on_it_and_for_how_long(): void
    {
        $court = $this->court();
        $now = VenueClock::now($this->org()->id);

        $this->bookingAt($court, $now->copy()->subMinutes(20), $now->copy()->addMinutes(40), 'คุณกำลังเล่น');

        $board = $this->board();
        $entry = $this->entryFor($board, $court->id);

        $this->assertSame('playing', $entry['status']);
        $this->assertSame('คุณกำลังเล่น', $entry['current']['customerName']);
        // Whole minutes, from the venue's clock.
        $this->assertSame(40, $entry['current']['minutesLeft']);
    }

    public function test_a_court_with_nobody_on_it_is_free(): void
    {
        $court = $this->court();

        $entry = $this->entryFor($this->board(), $court->id);

        $this->assertSame('free', $entry['status']);
        $this->assertNull($entry['current']);
    }

    /** Free now but booked at four is not the same as free all day. */
    public function test_a_free_court_still_shows_what_is_coming(): void
    {
        $court = $this->court();
        $now = VenueClock::now($this->org()->id);

        $this->bookingAt($court, $now->copy()->addMinutes(90), $now->copy()->addMinutes(150), 'คุณคิวถัดไป');

        $entry = $this->entryFor($this->board(), $court->id);

        $this->assertSame('free', $entry['status']);
        $this->assertSame('คุณคิวถัดไป', $entry['next']['customerName']);
        $this->assertSame(90, $entry['next']['minutesUntil']);
    }

    /** A booking that has finished is not "next". */
    public function test_a_finished_booking_is_not_shown_as_the_queue(): void
    {
        $court = $this->court();
        $now = VenueClock::now($this->org()->id);

        $this->bookingAt($court, $now->copy()->subHours(3), $now->copy()->subHours(2), 'คุณเล่นจบแล้ว');

        $entry = $this->entryFor($this->board(), $court->id);

        $this->assertSame('free', $entry['status']);
        $this->assertNull($entry['next']);
    }

    /**
     * The bug this endpoint exists to avoid.
     *
     * Bookings are wall-clock. With the server on UTC and the venue in Bangkok,
     * a board that used the server's clock would call a court free while
     * somebody is on it — so this asserts the two disagree and the board
     * follows the venue.
     */
    public function test_the_board_follows_the_venue_clock_not_the_servers(): void
    {
        $court = $this->court();
        $venueNow = VenueClock::now($this->org()->id);

        $this->assertNotSame(
            $venueNow->format('H:i'),
            Carbon::now('UTC')->format('H:i'),
            'this test only means something while the venue is not on UTC',
        );

        // Playing right now on the venue's clock — and outside that window on
        // the server's.
        $this->bookingAt($court, $venueNow->copy()->subMinutes(10), $venueNow->copy()->addMinutes(50), 'คุณเวลาสนาม');

        $board = $this->board();

        $this->assertSame($venueNow->format('H:i'), $board['now']);
        $this->assertSame('playing', $this->entryFor($board, $court->id)['status']);
    }

    /** Booked and actually turning up are different things at the desk. */
    public function test_it_says_whether_the_current_booking_checked_in(): void
    {
        $court = $this->court();
        $now = VenueClock::now($this->org()->id);

        $booking = $this->bookingAt($court, $now->copy()->subMinutes(5), $now->copy()->addMinutes(55), 'คุณยังไม่เช็คอิน');

        $this->assertFalse($this->entryFor($this->board(), $court->id)['current']['checkedIn']);

        $booking->update(['checked_in_at' => now()]);

        $this->assertTrue($this->entryFor($this->board(), $court->id)['current']['checkedIn']);
    }

    /** A cancelled booking does not hold a court. */
    public function test_a_cancelled_booking_leaves_the_court_free(): void
    {
        $court = $this->court();
        $now = VenueClock::now($this->org()->id);

        $this->bookingAt($court, $now->copy()->subMinutes(10), $now->copy()->addMinutes(50), 'คุณยกเลิก')
            ->update(['status' => 'cancelled']);

        $this->assertSame('free', $this->entryFor($this->board(), $court->id)['status']);
    }

    /** The board is laid out the way the venue is. */
    public function test_courts_are_grouped_under_their_branch(): void
    {
        $board = $this->board();

        $this->assertNotEmpty($board['branches']);
        foreach ($board['branches'] as $branch) {
            $this->assertNotNull($branch['name']);
            $this->assertNotEmpty($branch['courts']);
        }
    }

    /** One venue's floor is not another's. */
    public function test_it_shows_only_this_venues_courts(): void
    {
        $ids = collect($this->board()['branches'])->flatMap(fn ($b) => collect($b['courts'])->pluck('id'))->all();
        $mine = Court::query()->forOrganization($this->org()->id)->pluck('id')->map(fn ($id) => (string) $id)->all();

        sort($ids);
        sort($mine);
        $this->assertSame($mine, $ids);
    }

    /** Reading the floor is part of the counter's job, not a manager's report. */
    public function test_counter_staff_can_read_the_board(): void
    {
        $staff = $this->staff('reception');

        $this->as($this->login($staff->email))
            ->getJson('/api/v1/owner/courts/live')
            ->assertOk();
    }

    // ---- fixtures ----------------------------------------------------------

    private function board(): array
    {
        return $this->as($this->login('owner@everyday.test'))
            ->getJson('/api/v1/owner/courts/live')
            ->assertOk()
            ->json('data');
    }

    private function entryFor(array $board, string $courtId): array
    {
        foreach ($board['branches'] as $branch) {
            foreach ($branch['courts'] as $court) {
                if ($court['id'] === (string) $courtId) {
                    return $court;
                }
            }
        }

        $this->fail("court {$courtId} is missing from the board");
    }

    private function bookingAt(Court $court, Carbon $from, Carbon $to, string $customerName): Booking
    {
        $customer = Customer::create([
            'organization_id' => $this->org()->id,
            'display_name' => $customerName,
        ]);

        return Booking::create([
            'organization_id' => $this->org()->id,
            'branch_id' => $court->branch_id,
            'court_id' => $court->id,
            'customer_id' => $customer->id,
            'code' => 'BKBOARD'.random_int(1000, 9999),
            'date' => $from->toDateString(),
            'start' => $from->format('H:i'),
            'end' => $to->format('H:i'),
            'amount' => 300,
            'status' => 'confirmed',
            'channel' => 'walkin',
        ]);
    }

    private function court(): Court
    {
        return Court::query()->forOrganization($this->org()->id)->orderBy('sort_order')->firstOrFail();
    }

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    private function as(string $token): self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    private function login(string $email): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/admin/login', ['email' => $email, 'password' => 'password'])->json('token');
    }

    private function staff(string $roleCode): User
    {
        $user = User::create([
            'name' => "staff-{$roleCode}",
            'display_name' => "staff-{$roleCode}",
            'email' => "{$roleCode}@board.test",
            'password' => bcrypt('password'),
            'status' => 'active',
        ]);

        OrganizationUser::create([
            'organization_id' => $this->org()->id,
            'user_id' => $user->id,
            'role_id' => Role::where('code', $roleCode)->value('id'),
            'display_name' => $user->display_name,
            'status' => 'active',
            'joined_at' => now(),
        ]);

        return $user;
    }
}
