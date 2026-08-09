<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\OrganizationSetting;
use App\Models\PointTransaction;
use App\Models\Wallet;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Points that a booking actually earns.
 *
 * Before this the only thing that could change a customer's points was a staff
 * member typing a number: booking, paying and turning up awarded nothing, and
 * tiers never moved — which quietly broke the member discount, since a customer
 * stuck on Silver forever can never reach the Gold rate.
 *
 * The venue's rule: a flat 10 points per booking, court bookings only.
 */
class PointsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
        Storage::fake('public');
        $this->enablePoints();
    }

    private function enablePoints(int $perBooking = 10, ?array $tiers = null): void
    {
        OrganizationSetting::query()->updateOrCreate(
            ['organization_id' => $this->org()->id],
            [
                'points_enabled' => true,
                'points_per_booking' => $perBooking,
                'tier_thresholds' => $tiers ?? ['Silver' => 0, 'Gold' => 50, 'Platinum' => 200],
            ],
        );
    }

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    private function token(string $lineId = 'Upoints'): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => $lineId,
            'displayName' => 'คุณสะสมแต้ม',
        ])->json('token');
    }

    private function ownerToken(): string
    {
        $this->app['auth']->forgetGuards();

        $t = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');

        $this->app['auth']->forgetGuards();

        return $t;
    }

    private function customer(string $lineId = 'Upoints'): Customer
    {
        return Customer::where('line_user_id', $lineId)->firstOrFail();
    }

    private function points(string $lineId = 'Upoints'): int
    {
        return (int) (Membership::where('customer_id', $this->customer($lineId)->id)->value('points') ?? 0);
    }

    private function book(string $token, string $date = '2027-06-01', int $courtIndex = 0): array
    {
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json("data.{$courtIndex}.id");
        $this->app['auth']->forgetGuards();

        return $this->withToken($token)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => $date,
            'start' => '18:00',
            'end' => '19:00',
        ])->assertCreated()->json('data');
    }

    /** Pay from credit — the shortest path to "fully paid". */
    private function payFromCredit(string $token, string $bookingId, string $lineId = 'Upoints'): void
    {
        $c = $this->customer($lineId);
        Wallet::query()->updateOrCreate(
            ['customer_id' => $c->id],
            ['organization_id' => $c->organization_id, 'balance' => 5000],
        );

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$bookingId}/pay-with-credit")->assertOk();
    }

    // ---- when points are earned -------------------------------------------

    /** A booking that has not been paid for is a reservation, not a purchase. */
    public function test_booking_alone_earns_nothing(): void
    {
        $token = $this->token();
        $this->book($token);

        $this->assertSame(0, $this->points(), 'awarding on creation would let anyone farm by cancelling');
    }

    /** Paying is what earns it. */
    public function test_paying_for_a_booking_earns_the_flat_rate(): void
    {
        $token = $this->token();
        $booking = $this->book($token);

        $this->payFromCredit($token, $booking['id']);

        $this->assertSame(10, $this->points());
    }

    /** Flat per booking: an hour and three hours earn the same, by design. */
    public function test_a_longer_booking_earns_the_same(): void
    {
        $token = $this->token();
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.1.id');
        $this->app['auth']->forgetGuards();

        $booking = $this->withToken($token)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => '2027-06-02',
            'start' => '18:00',
            'end' => '21:00', // 3 hours
        ])->assertCreated()->json('data');

        $this->payFromCredit($token, $booking['id']);

        $this->assertSame(10, $this->points());
    }

    /** The venue sets the rate; 10 is a default, not a constant. */
    public function test_the_rate_is_the_venues_own(): void
    {
        $this->enablePoints(perBooking: 25);

        $token = $this->token();
        $booking = $this->book($token, '2027-06-03');
        $this->payFromCredit($token, $booking['id']);

        $this->assertSame(25, $this->points());
    }

    /** Off by default — a venue that has not opted in awards nothing. */
    public function test_points_off_means_nothing_is_awarded(): void
    {
        OrganizationSetting::query()->updateOrCreate(
            ['organization_id' => $this->org()->id],
            ['points_enabled' => false],
        );

        $token = $this->token();
        $booking = $this->book($token, '2027-06-04');
        $this->payFromCredit($token, $booking['id']);

        $this->assertSame(0, $this->points());
    }

    /**
     * One booking, one award — however many payments it took.
     *
     * A deposit then a balance is two trips through the money path, and both
     * ask whether to award.
     */
    public function test_a_booking_earns_once_even_when_paid_in_parts(): void
    {
        OrganizationSetting::query()->updateOrCreate(
            ['organization_id' => $this->org()->id],
            ['points_enabled' => true, 'points_per_booking' => 10, 'deposit_enabled' => true, 'deposit_type' => 'percent', 'deposit_value' => 40],
        );

        $token = $this->token();
        $booking = $this->book($token, '2027-06-05');

        $c = $this->customer();
        Wallet::query()->updateOrCreate(['customer_id' => $c->id], ['organization_id' => $c->organization_id, 'balance' => 5000]);

        // Deposit only — still owing, so nothing yet.
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$booking['id']}/pay-with-credit", ['amount' => 100])->assertOk();
        $this->assertSame(0, $this->points(), 'a part-paid booking has not been bought yet');

        // The rest.
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$booking['id']}/pay-with-credit")->assertOk();

        $this->assertSame(10, $this->points());
        $this->assertSame(1, PointTransaction::where('booking_id', $booking['id'])->where('source', 'booking')->count());
    }

    /** A slip approved at the counter earns just the same. */
    public function test_paying_by_slip_earns_too(): void
    {
        $token = $this->token();
        $booking = $this->book($token, '2027-06-06');

        $paymentId = $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $booking['id'], 'method' => 'transfer',
        ])->assertCreated()->json('data.id');

        $this->withToken($token)->postJson("/api/v1/payments/{$paymentId}/upload-slip", [
            'slip' => UploadedFile::fake()->image('slip.png'),
        ])->assertOk();

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/payments/{$paymentId}/verify")->assertOk();

        $this->assertSame(10, $this->points());
    }

    // ---- and when they are taken back --------------------------------------

    /**
     * The farm this closes: pay, collect the points, cancel, take the money back
     * as credit, keep the points.
     */
    public function test_cancelling_takes_the_points_back(): void
    {
        $token = $this->token();
        $booking = $this->book($token, '2027-06-07');
        $this->payFromCredit($token, $booking['id']);
        $this->assertSame(10, $this->points());

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$booking['id']}/cancel")->assertOk();

        $this->assertSame(0, $this->points());
    }

    /** Cancelling a booking that never earned takes nothing. */
    public function test_cancelling_an_unpaid_booking_takes_nothing(): void
    {
        $token = $this->token();
        $booking = $this->book($token, '2027-06-08');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$booking['id']}/cancel")->assertOk();

        $this->assertSame(0, $this->points());
        $this->assertSame(0, PointTransaction::where('booking_id', $booking['id'])->count());
    }

    /** The venue cancelling it has the same effect as the customer doing so. */
    public function test_the_venue_cancelling_also_takes_them_back(): void
    {
        $token = $this->token();
        $booking = $this->book($token, '2027-06-09');
        $this->payFromCredit($token, $booking['id']);

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/bookings/{$booking['id']}/cancel")->assertOk();

        $this->assertSame(0, $this->points());
    }

    // ---- tiers --------------------------------------------------------------

    /**
     * Tiers have to move, or the member discount is unreachable: it is keyed by
     * tier, and everyone was created Silver and stayed there forever.
     */
    public function test_earning_enough_promotes_the_tier(): void
    {
        $token = $this->token();

        // 50 lifetime points reaches Gold on this venue's ladder.
        for ($i = 0; $i < 5; $i++) {
            $booking = $this->book($token, '2027-07-0'.($i + 1), courtIndex: $i);
            $this->payFromCredit($token, $booking['id']);
        }

        $membership = Membership::where('customer_id', $this->customer()->id)->firstOrFail();

        $this->assertSame(50, (int) $membership->lifetime_points);
        $this->assertSame('Gold', $membership->tier);
    }

    /** Spending points must not demote someone who already earned the tier. */
    public function test_spending_points_does_not_demote(): void
    {
        $token = $this->token();

        for ($i = 0; $i < 5; $i++) {
            $booking = $this->book($token, '2027-08-0'.($i + 1), courtIndex: $i);
            $this->payFromCredit($token, $booking['id']);
        }

        $membership = Membership::where('customer_id', $this->customer()->id)->firstOrFail();
        $this->assertSame('Gold', $membership->tier);

        // Staff take 40 away — the balance drops, the standing does not.
        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/memberships/{$membership->id}/points", ['delta' => -40, 'note' => 'แลกของรางวัล'])
            ->assertOk();

        $membership->refresh();
        $this->assertSame(10, (int) $membership->points);
        $this->assertSame('Gold', $membership->tier, 'a tier already earned is not taken back by spending');
    }

    /** A clawback is not spending — it undoes points that turned out not to exist. */
    public function test_a_cancellation_can_demote(): void
    {
        $token = $this->token();

        for ($i = 0; $i < 5; $i++) {
            $bookings[] = $this->book($token, '2027-09-0'.($i + 1), courtIndex: $i);
            $this->payFromCredit($token, end($bookings)['id']);
        }

        $this->assertSame('Gold', Membership::where('customer_id', $this->customer()->id)->value('tier'));

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$bookings[0]['id']}/cancel")->assertOk();

        $membership = Membership::where('customer_id', $this->customer()->id)->firstOrFail();
        $this->assertSame(40, (int) $membership->lifetime_points);
        $this->assertSame('Silver', $membership->tier);
    }

    /** The card can say how far the next tier is, or it is a badge with no meaning. */
    public function test_the_membership_card_shows_progress_to_the_next_tier(): void
    {
        $token = $this->token();
        $booking = $this->book($token, '2027-10-01');
        $this->payFromCredit($token, $booking['id']);

        $this->app['auth']->forgetGuards();
        $body = $this->withToken($token)->getJson('/api/v1/membership')->assertOk()->json('data');

        $this->assertSame(10, (int) $body['lifetimePoints']);
        $this->assertSame('Gold', $body['nextTier']);
        $this->assertSame(40, (int) $body['pointsToNextTier']);
    }

    // ---- the ledger ---------------------------------------------------------

    /** Earning is the system's doing; nobody has to answer for it. */
    public function test_earning_is_recorded_without_a_staff_name(): void
    {
        $token = $this->token();
        $booking = $this->book($token, '2027-11-01');
        $this->payFromCredit($token, $booking['id']);

        $rows = $this->withToken($this->ownerToken())
            ->getJson("/api/v1/owner/customer-credit/{$this->customer()->id}/points")
            ->assertOk()->json('data');

        $this->assertSame(10, (int) $rows[0]['points']);
        $this->assertSame('booking', $rows[0]['source']);
        $this->assertNull($rows[0]['byName']);
        $this->assertStringContainsString($booking['code'], $rows[0]['label']);
    }

    /**
     * A staff adjustment is. The old endpoint took a `note` and threw it away —
     * its own comment admitted it.
     */
    public function test_a_staff_adjustment_records_the_reason_and_the_person(): void
    {
        $token = $this->token();
        $this->book($token, '2027-11-02');
        $membership = Membership::firstOrCreate(
            ['customer_id' => $this->customer()->id],
            ['organization_id' => $this->org()->id, 'tier' => 'Silver', 'member_id' => 'SM-X', 'points' => 0, 'expires_at' => ''],
        );

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/memberships/{$membership->id}/points", ['delta' => 200, 'note' => 'ชดเชยคอร์ทเสีย'])
            ->assertOk();

        $rows = $this->withToken($this->ownerToken())
            ->getJson("/api/v1/owner/customer-credit/{$this->customer()->id}/points")
            ->assertOk()->json('data');

        $this->assertSame(200, (int) $rows[0]['points']);
        $this->assertSame('adjustment', $rows[0]['source']);
        $this->assertSame('ชดเชยคอร์ทเสีย', $rows[0]['label']);
        $this->assertSame('Everyday Owner', $rows[0]['byName']);
    }

    /** A walk-in with no customer attached must not crash the award. */
    public function test_a_walk_in_without_a_customer_is_skipped(): void
    {
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');

        $this->withToken($this->ownerToken())->postJson('/api/v1/owner/bookings', [
            'courtId' => $courtId,
            'date' => '2027-12-01',
            'start' => '18:00',
            'end' => '19:00',
            'customerName' => 'คนเดินเข้ามา',
        ])->assertCreated();

        // The walk-in customer row exists and earns — what must not happen is a
        // crash, or points attributed to nobody.
        $this->assertSame(0, PointTransaction::whereNull('customer_id')->count());
    }
}
