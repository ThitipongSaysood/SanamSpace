<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Support\PlanFeatures;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * The numbers on the pricing page.
 *
 * "1 สาขา · 4 คอร์ท · 3 พนักงาน" was stored on the plan, editable in the admin
 * screens and read by nothing: a Starter venue could open fifty courts. Feature
 * gating decided WHICH pages a venue sees; this decides HOW MUCH.
 */
class PlanLimitTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
        $this->org = Organization::where('slug', 'everyday-badminton')->firstOrFail();
        PlanFeatures::flush();
    }

    private function login(): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');
    }

    private function as(string $token): TestResponse|self
    {
        return $this->withToken($token)->withHeader('X-Venue-Slug', $this->org->slug);
    }

    /** Put the venue on a plan with the given ceilings. */
    private function withLimits(array $limits): string
    {
        $plan = Plan::create(array_merge([
            'code' => 'test-'.uniqid(),
            'name' => 'Test',
            'price' => 100,
            'interval' => 'month',
            'is_active' => true,
        ], $limits));

        Subscription::query()->forOrganization($this->org->id)->update(['plan_id' => $plan->id]);
        PlanFeatures::flush();

        return $this->login();
    }

    // --- the ceilings that are enforced ------------------------------------

    public function test_a_venue_at_its_court_ceiling_cannot_add_another(): void
    {
        // The demo venue has 6 courts already.
        $token = $this->withLimits(['court_limit' => 6]);
        $branchId = Branch::query()->forOrganization($this->org->id)->value('id');

        $this->as($token)->postJson('/api/v1/owner/courts', [
            'branchId' => $branchId,
            'name' => 'คอร์ท 7',
            'sport' => 'badminton',
            'pricePerHour' => 200,
        ])
            ->assertStatus(402)
            ->assertJsonPath('code', 'plan_limit_reached')
            // The refusal has to name the number, or the owner's only next step
            // is to contact support.
            ->assertJsonPath('limit', 6)
            ->assertJsonPath('used', 6);
    }

    public function test_raising_the_ceiling_lets_it_through(): void
    {
        $token = $this->withLimits(['court_limit' => 7]);
        $branchId = Branch::query()->forOrganization($this->org->id)->value('id');

        $this->as($token)->postJson('/api/v1/owner/courts', [
            'branchId' => $branchId,
            'name' => 'คอร์ท 7',
            'sport' => 'badminton',
            'pricePerHour' => 200,
        ])->assertCreated();
    }

    public function test_an_unlimited_plan_has_no_ceiling(): void
    {
        $token = $this->withLimits(['court_limit' => null]);
        $branchId = Branch::query()->forOrganization($this->org->id)->value('id');

        $this->as($token)->postJson('/api/v1/owner/courts', [
            'branchId' => $branchId,
            'name' => 'คอร์ท 7',
            'sport' => 'badminton',
            'pricePerHour' => 200,
        ])->assertCreated();
    }

    public function test_the_branch_ceiling_is_enforced_too(): void
    {
        $token = $this->withLimits(['branch_limit' => 1]);

        $this->as($token)->postJson('/api/v1/owner/branches', [
            'name' => 'สาขาสอง',
            'address' => 'ที่ไหนสักแห่ง',
        ])
            ->assertStatus(402)
            ->assertJsonPath('resource', 'branch');
    }

    public function test_the_staff_ceiling_is_enforced_too(): void
    {
        $token = $this->withLimits(['staff_limit' => 1]);

        $this->as($token)->postJson('/api/v1/owner/staff', [
            'name' => 'พนักงานใหม่',
            'email' => 'new-staff@everyday.test',
            'roleCode' => 'staff',
        ])
            ->assertStatus(402)
            ->assertJsonPath('resource', 'staff');
    }

    // --- what must NOT be blocked ------------------------------------------

    /**
     * A venue that downgrades is over its ceiling by definition. If being over
     * it also locked editing, the plan change would lock an owner out of their
     * own courts — a worse bug than the one being fixed here.
     */
    public function test_being_over_the_ceiling_still_allows_editing_and_deleting(): void
    {
        $token = $this->withLimits(['court_limit' => 1]);
        $courtId = \App\Models\Court::query()->forOrganization($this->org->id)->value('id');

        $this->as($token)->putJson("/api/v1/owner/courts/{$courtId}", ['name' => 'เปลี่ยนชื่อได้'])
            ->assertOk();
    }

    /**
     * The deliberate asymmetry. A booking comes from a customer who has no idea
     * a plan exists; turning them away would take the venue's revenue to
     * enforce the platform's billing. This system already decided the other way
     * once — an expired venue is locked out of its portal while its customers
     * keep booking.
     */
    public function test_the_monthly_booking_count_is_reported_but_never_blocks_a_booking(): void
    {
        $token = $this->withLimits(['monthly_booking_limit' => 1]);

        $limits = $this->as($token)->getJson('/api/v1/owner/subscription')->assertOk()->json('data.limits');
        $this->assertSame(1, $limits['booking']['limit']);
        $this->assertFalse($limits['booking']['enforced']);

        $branchId = Branch::query()->forOrganization($this->org->id)->value('id');
        $courtId = \App\Models\Court::query()->forOrganization($this->org->id)->where('branch_id', $branchId)->value('id');

        $this->as($token)->postJson('/api/v1/owner/bookings', [
            'courtId' => $courtId,
            'date' => now()->addDay()->toDateString(),
            'start' => '09:00',
            'end' => '10:00',
            'customerName' => 'ลูกค้าเดินเข้ามา',
        ])->assertCreated();
    }

    /**
     * A missing billing row must not read as a ceiling of zero.
     *
     * Asserted below the HTTP layer on purpose: over the wire such a venue is
     * already stopped earlier and for a different reason —
     * EnsureSubscriptionActive answers 402 subscription_expired — so a request
     * here would pass for the wrong reason and go on passing if this rule broke.
     */
    public function test_a_venue_with_no_plan_has_no_ceiling(): void
    {
        Subscription::query()->forOrganization($this->org->id)->forceDelete();

        $this->assertNull(\App\Support\PlanLimits::limitFor($this->org->id, 'court'));
        $this->assertFalse(\App\Support\PlanLimits::isFull($this->org->id, 'court'));
    }

    // --- what the venue is shown -------------------------------------------

    public function test_the_subscription_reports_usage_against_every_limit(): void
    {
        $token = $this->withLimits(['branch_limit' => 2, 'court_limit' => 8, 'staff_limit' => 5]);

        $limits = $this->as($token)->getJson('/api/v1/owner/subscription')->assertOk()->json('data.limits');

        $this->assertSame(6, $limits['court']['used']);
        $this->assertSame(8, $limits['court']['limit']);
        $this->assertTrue($limits['court']['enforced']);
        $this->assertSame('คอร์ท', $limits['court']['label']);
    }

    /** A platform admin supports venues from outside the paywall. */
    public function test_a_super_admin_is_not_stopped_by_a_venue_ceiling(): void
    {
        $this->withLimits(['court_limit' => 1]);

        $superToken = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'super@sanamspace.test',
            'password' => 'password',
        ])->json('token');

        // Super admins reach owner routes only through a membership.
        $this->org->organizationUsers()->firstOrCreate(
            ['user_id' => User::where('email', 'super@sanamspace.test')->value('id')],
            [
                'role_id' => \App\Models\Role::where('code', 'owner')->value('id'),
                'display_name' => 'Platform Admin',
                'status' => 'active',
                'joined_at' => now(),
            ],
        );

        $branchId = Branch::query()->forOrganization($this->org->id)->value('id');

        $this->withToken($superToken)->withHeader('X-Venue-Slug', $this->org->slug)
            ->postJson('/api/v1/owner/courts', [
                'branchId' => $branchId,
                'name' => 'คอร์ทที่แอดมินเพิ่ม',
                'sport' => 'badminton',
                'pricePerHour' => 200,
            ])->assertCreated();
    }
}
