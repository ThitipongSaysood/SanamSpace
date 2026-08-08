<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\CustomerSegment;
use App\Models\Organization;
use App\Services\SegmentService;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Segments that answer a question rather than hold a stale list.
 *
 * `customer_segments.criteria` was a column nothing read: every segment was
 * hand-picked, so "ลูกค้าที่หายไป 60 วัน" was true on the day it was saved and
 * drifted from then on.
 */
class DynamicSegmentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
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

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    private function courtId(): string
    {
        return $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');
    }

    /** A customer with a controllable booking history. */
    private function customerWith(string $name, array $bookingDates, float $spend = 0): Customer
    {
        $customer = Customer::create([
            'organization_id' => $this->org()->id,
            'display_name' => $name,
            'total_spending' => $spend,
        ]);

        $courtId = $this->courtId();
        $branchId = \App\Models\Court::find($courtId)->branch_id;

        foreach ($bookingDates as $i => $date) {
            Booking::create([
                'organization_id' => $this->org()->id,
                'branch_id' => $branchId,
                'court_id' => $courtId,
                'customer_id' => $customer->id,
                'code' => 'SEG'.substr(md5($name.$i), 0, 8),
                'date' => $date,
                // Spread across the day so the same court is not double-booked.
                'start' => sprintf('%02d:00', 6 + ($i % 14)),
                'end' => sprintf('%02d:00', 7 + ($i % 14)),
                'amount' => 250,
                'court_amount' => 250,
                'status' => 'confirmed',
            ]);
        }

        return $customer;
    }

    private function service(): SegmentService
    {
        return app(SegmentService::class);
    }

    /**
     * A venue of its own, for the RFM tests.
     *
     * RFM is scored by rank *within an organization*, so a customer's label
     * depends on who else is there. Testing it against the seeded venue would
     * be asserting the shape of the demo data, not the scoring.
     *
     * @return array{0: Organization, 1: string} org and a court id
     */
    private function freshVenue(): array
    {
        $org = Organization::create(['name' => 'RFM Test Arena', 'slug' => 'rfm-test-arena']);
        $branch = \App\Models\Branch::create([
            'organization_id' => $org->id,
            'name' => 'สาขาเดียว',
            'status' => 'active',
        ]);
        $court = \App\Models\Court::create([
            'organization_id' => $org->id,
            'branch_id' => $branch->id,
            'name' => 'Court 1',
            'sport' => 'badminton',
            'price_per_hour' => 250,
            'status' => 'active',
        ]);

        return [$org, $court->id];
    }

    /** Same as customerWith, but in a given org/court. */
    private function customerIn(Organization $org, string $courtId, string $name, array $dates, float $spend = 0): Customer
    {
        $customer = Customer::create([
            'organization_id' => $org->id,
            'display_name' => $name,
            'total_spending' => $spend,
        ]);

        $branchId = \App\Models\Court::find($courtId)->branch_id;

        foreach ($dates as $i => $date) {
            Booking::create([
                'organization_id' => $org->id,
                'branch_id' => $branchId,
                'court_id' => $courtId,
                'customer_id' => $customer->id,
                'code' => 'RFM'.substr(md5($name.$i), 0, 8),
                'date' => $date,
                'start' => sprintf('%02d:00', 6 + ($i % 14)),
                'end' => sprintf('%02d:00', 7 + ($i % 14)),
                'amount' => 250,
                'court_amount' => 250,
                'status' => 'confirmed',
            ]);
        }

        return $customer;
    }

    // ---- criteria --------------------------------------------------------

    /** "Booked at least 3 times" is a question, and it now has an answer. */
    public function test_a_minimum_bookings_criterion_selects_the_right_people(): void
    {
        $regular = $this->customerWith('ขาประจำ', ['2026-08-01', '2026-08-02', '2026-08-03']);
        $once = $this->customerWith('มาครั้งเดียว', ['2026-08-01']);

        $ids = $this->service()->matching($this->org()->id, ['minBookings' => 3])->pluck('id');

        $this->assertContains($regular->id, $ids);
        $this->assertNotContains($once->id, $ids);
    }

    /** "Has not been back in N days" must exclude people who never came at all. */
    public function test_lapsed_means_stopped_coming_not_never_came(): void
    {
        $lapsed = $this->customerWith('หายไปนาน', [now()->subDays(120)->toDateString()]);
        $recent = $this->customerWith('เพิ่งมา', [now()->subDays(3)->toDateString()]);
        $never = $this->customerWith('ไม่เคยจอง', []);

        $ids = $this->service()->matching($this->org()->id, ['notBookedForDays' => 60])->pluck('id');

        $this->assertContains($lapsed->id, $ids);
        $this->assertNotContains($recent->id, $ids);
        $this->assertNotContains($never->id, $ids, 'never booked is a different group');
    }

    /** Spend is a filter people actually ask for. */
    public function test_a_spend_criterion_filters_by_money(): void
    {
        $big = $this->customerWith('จ่ายเยอะ', [], spend: 5000);
        $small = $this->customerWith('จ่ายน้อย', [], spend: 100);

        $ids = $this->service()->matching($this->org()->id, ['minSpend' => 1000])->pluck('id');

        $this->assertContains($big->id, $ids);
        $this->assertNotContains($small->id, $ids);
    }

    /** Criteria stack — each one narrows what the last left. */
    public function test_criteria_combine(): void
    {
        $match = $this->customerWith('ตรงทุกข้อ', ['2026-08-01', '2026-08-02'], spend: 3000);
        $poor = $this->customerWith('จองบ่อยแต่จ่ายน้อย', ['2026-08-01', '2026-08-02'], spend: 10);

        $ids = $this->service()
            ->matching($this->org()->id, ['minBookings' => 2, 'minSpend' => 1000])
            ->pluck('id');

        $this->assertContains($match->id, $ids);
        $this->assertNotContains($poor->id, $ids);
    }

    /** A segment saved by a newer version must not break an older one. */
    public function test_unknown_criteria_keys_are_ignored(): void
    {
        $someone = $this->customerWith('ใครสักคน', ['2026-08-01']);

        $ids = $this->service()
            ->matching($this->org()->id, ['somethingFromTheFuture' => 42])
            ->pluck('id');

        $this->assertContains($someone->id, $ids);
    }

    /** Opting out beats every criterion. */
    public function test_an_unsubscribed_customer_never_matches(): void
    {
        $optedOut = $this->customerWith('ขอไม่รับ', ['2026-08-01', '2026-08-02', '2026-08-03']);
        $optedOut->update(['unsubscribed_at' => now()]);

        $ids = $this->service()->matching($this->org()->id, ['minBookings' => 1])->pluck('id');

        $this->assertNotContains($optedOut->id, $ids);
    }

    // ---- the segment itself ----------------------------------------------

    /** Saving criteria makes a segment dynamic, and its size is computed. */
    public function test_a_segment_with_criteria_reports_a_live_count(): void
    {
        $this->customerWith('ขาประจำ 1', ['2026-08-01', '2026-08-02']);
        $this->customerWith('ขาประจำ 2', ['2026-08-03', '2026-08-04']);

        $token = $this->ownerToken();

        $body = $this->withToken($token)->postJson('/api/v1/owner/segments', [
            'name' => 'จอง 2 ครั้งขึ้นไป',
            'criteria' => ['minBookings' => 2],
        ])->assertCreated()->json('data');

        $this->assertTrue($body['dynamic']);
        $this->assertSame(2, $body['memberCount']);

        // A third qualifies later — the count moves without anyone editing it.
        $this->customerWith('ขาประจำ 3', ['2026-08-05', '2026-08-06']);

        $row = collect($this->withToken($token)->getJson('/api/v1/owner/segments')->json('data'))
            ->firstWhere('name', 'จอง 2 ครั้งขึ้นไป');

        $this->assertSame(3, $row['memberCount']);
    }

    /** A hand-picked segment keeps working exactly as it did. */
    public function test_a_segment_without_criteria_stays_a_hand_picked_list(): void
    {
        $token = $this->ownerToken();

        $body = $this->withToken($token)->postJson('/api/v1/owner/segments', [
            'name' => 'รายชื่อที่เลือกเอง',
        ])->assertCreated()->json('data');

        $this->assertFalse($body['dynamic']);
        $this->assertSame(0, $body['memberCount']);
    }

    /** The owner can see who is in it before messaging them. */
    public function test_the_members_of_a_dynamic_segment_can_be_listed(): void
    {
        $regular = $this->customerWith('ขาประจำ', ['2026-08-01', '2026-08-02']);
        $this->customerWith('มาครั้งเดียว', ['2026-08-01']);

        $token = $this->ownerToken();
        $id = $this->withToken($token)->postJson('/api/v1/owner/segments', [
            'name' => 'ขาประจำ',
            'criteria' => ['minBookings' => 2],
        ])->assertCreated()->json('data.id');

        $body = $this->withToken($token)->getJson("/api/v1/owner/segments/{$id}/members")->assertOk()->json();

        $this->assertTrue($body['dynamic']);
        $this->assertContains($regular->id, array_column($body['data'], 'id'));
    }

    /** Broadcasting to a dynamic segment reaches whoever qualifies now. */
    public function test_a_broadcast_to_a_dynamic_segment_uses_the_live_membership(): void
    {
        $this->customerWith('ขาประจำ 1', ['2026-08-01', '2026-08-02']);

        $token = $this->ownerToken();
        $segmentId = $this->withToken($token)->postJson('/api/v1/owner/segments', [
            'name' => 'ขาประจำ',
            'criteria' => ['minBookings' => 2],
        ])->assertCreated()->json('data.id');

        // Qualifies only after the segment was created.
        $this->customerWith('ขาประจำ 2', ['2026-08-03', '2026-08-04']);

        $broadcastId = $this->withToken($token)->postJson('/api/v1/owner/broadcasts', [
            'title' => 'ส่วนลดขาประจำ',
            'message' => 'ขอบคุณที่มาบ่อย',
            'channel' => 'app',
            'audience' => 'segment',
            'segmentId' => $segmentId,
        ])->assertCreated()->json('data.id');

        $this->withToken($token)->postJson("/api/v1/owner/broadcasts/{$broadcastId}/send")
            ->assertOk()
            ->assertJsonPath('data.recipientCount', 2);
    }

    // ---- RFM -------------------------------------------------------------

    /** Someone frequent and recent is a champion; someone gone is not. */
    public function test_rfm_separates_the_recent_regular_from_the_long_gone(): void
    {
        [$org, $courtId] = $this->freshVenue();

        $champion = $this->customerIn($org, $courtId, 'มาบ่อยและเพิ่งมา', [
            now()->subDays(1)->toDateString(),
            now()->subDays(3)->toDateString(),
            now()->subDays(5)->toDateString(),
            now()->subDays(7)->toDateString(),
        ], spend: 5000);

        $gone = $this->customerIn($org, $courtId, 'หายไปนาน', [now()->subDays(300)->toDateString()], spend: 200);

        $scores = $this->service()->rfm($org->id);

        $this->assertSame('champions', $scores[$champion->id]['label']);
        $this->assertContains($scores[$gone->id]['label'], ['lost', 'at_risk']);
        $this->assertGreaterThan($scores[$gone->id]['r'], $scores[$champion->id]['r']);
    }

    /** Never having booked is its own thing, not "lapsed a very long time ago". */
    public function test_someone_who_never_booked_is_labelled_as_such(): void
    {
        [$org, $courtId] = $this->freshVenue();
        $never = $this->customerIn($org, $courtId, 'ไม่เคยจอง', []);

        $scores = $this->service()->rfm($org->id);

        $this->assertSame('never_booked', $scores[$never->id]['label']);
        $this->assertNull($scores[$never->id]['recencyDays']);
    }

    /** The CRM screen gets a distribution plus names worth calling. */
    public function test_the_rfm_endpoint_returns_groups_and_names(): void
    {
        $this->customerWith('มาบ่อย', [
            now()->subDays(1)->toDateString(),
            now()->subDays(2)->toDateString(),
            now()->subDays(3)->toDateString(),
        ], spend: 4000);

        $body = $this->withToken($this->ownerToken())
            ->getJson('/api/v1/owner/crm/rfm')->assertOk()->json();

        $this->assertGreaterThan(0, $body['total']);
        $this->assertNotEmpty($body['groups']);
        $this->assertArrayHasKey('atRisk', $body);
        $this->assertArrayHasKey('champions', $body);
    }

    /** An RFM label is usable as a segment criterion. */
    public function test_a_segment_can_be_built_from_an_rfm_label(): void
    {
        [$org, $courtId] = $this->freshVenue();

        $champion = $this->customerIn($org, $courtId, 'แชมป์', [
            now()->subDays(1)->toDateString(),
            now()->subDays(2)->toDateString(),
            now()->subDays(3)->toDateString(),
            now()->subDays(4)->toDateString(),
        ], spend: 9000);

        $this->customerIn($org, $courtId, 'เงียบไป', [now()->subDays(200)->toDateString()], spend: 50);

        $ids = $this->service()
            ->matching($org->id, ['rfmLabel' => ['champions']])
            ->pluck('id');

        $this->assertContains($champion->id, $ids);
    }

    /** Cross-org segments stay invisible. */
    public function test_another_venues_segment_is_not_reachable(): void
    {
        $tsr = Organization::where('slug', 'tsr-arena')->firstOrFail();
        $theirs = CustomerSegment::create([
            'organization_id' => $tsr->id,
            'name' => 'ของสนามอื่น',
            'criteria' => ['minBookings' => 1],
        ]);

        $this->withToken($this->ownerToken())
            ->getJson("/api/v1/owner/segments/{$theirs->id}/members")
            ->assertNotFound();
    }
}
