<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Plan;
use App\Models\Subscription;
use App\Support\PlanFeatures;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The plan a venue pays for, enforced.
 *
 * The catalogue was stored, editable and printed on the pricing page while
 * being read by nothing: a Starter venue at ฿990 had exactly what an Enterprise
 * venue had. These are the assertions that keep the price list honest.
 *
 * The other half matters just as much — that the core stays open. Gating a
 * venue out of its own bookings would turn a pricing decision into an outage.
 */
class PlanFeatureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
        PlanFeatures::flush();
    }

    // ---- what a plan does and does not include -----------------------------

    public function test_a_starter_venue_cannot_reach_the_paid_features(): void
    {
        $this->onPlan('starter');
        $token = $this->login();

        // 402, not 403: nothing is wrong with the request or the person making
        // it, and the client shows an upgrade prompt rather than "ask your boss".
        foreach (['/api/v1/owner/products', '/api/v1/owner/rental-items', '/api/v1/owner/coupons'] as $url) {
            $this->as($token)->getJson($url)
                ->assertStatus(402)
                ->assertJsonPath('code', 'feature_not_in_plan');
        }
    }

    public function test_a_business_venue_reaches_the_business_features(): void
    {
        $this->onPlan('business');
        $token = $this->login();

        $this->as($token)->getJson('/api/v1/owner/products')->assertOk();
        $this->as($token)->getJson('/api/v1/owner/rental-items')->assertOk();
        $this->as($token)->getJson('/api/v1/owner/customer-credit')->assertOk();
    }

    /** Business pays for the shop; the marketing tools are the next tier up. */
    public function test_a_business_venue_still_cannot_reach_the_pro_features(): void
    {
        $this->onPlan('business');
        $token = $this->login();

        $this->as($token)->getJson('/api/v1/owner/crm/overview')->assertStatus(402);
        $this->as($token)->getJson('/api/v1/owner/broadcasts')->assertStatus(402);
    }

    public function test_a_pro_venue_reaches_everything(): void
    {
        $this->onPlan('pro');
        $token = $this->login();

        $this->as($token)->getJson('/api/v1/owner/products')->assertOk();
        $this->as($token)->getJson('/api/v1/owner/crm/overview')->assertOk();
        $this->as($token)->getJson('/api/v1/owner/broadcasts')->assertOk();
    }

    /**
     * Reading the numbers is core; carrying them out as a file is what the
     * catalogue sells as "รายงานขั้นสูง + ส่งออก".
     *
     * This is here because advanced_reports was the one code in the catalogue
     * with no route behind it — listed on the pricing matrix, toggleable in the
     * admin grid, and enforced nowhere. Exactly the decoration the gating was
     * built to end.
     */
    public function test_exporting_reports_is_the_pro_half_of_reporting(): void
    {
        $this->onPlan('starter');
        $token = $this->login();

        // The reports themselves stay open — a venue that cannot see its own
        // numbers has no reason to pay at all.
        $this->as($token)->getJson('/api/v1/owner/dashboard')->assertOk();
        $this->as($token)->getJson('/api/v1/owner/reports/bookings.csv')
            ->assertStatus(402)
            ->assertJsonPath('code', 'feature_not_in_plan');

        $this->onPlan('pro');
        $this->as($this->login())->getJson('/api/v1/owner/reports/bookings.csv')->assertOk();
    }

    /**
     * Every code in the catalogue must be attached to something.
     *
     * A feature with no route is a line on the pricing page that a venue can
     * pay for and receive nothing for, and nothing else in the suite would
     * notice — the gap this test exists to close was found by hand, once.
     */
    public function test_every_catalogue_feature_actually_gates_a_route(): void
    {
        $routes = file_get_contents(base_path('routes/api.php'));

        foreach (\App\Support\PlanCatalogue::codes() as $code) {
            $this->assertStringContainsString(
                "feature:{$code}'",
                $routes,
                "the plan catalogue sells '{$code}' but no route enforces it",
            );
        }
    }

    // ---- the core is never gated -------------------------------------------

    /**
     * The rule that keeps this from becoming an outage: everything a venue
     * needs to operate is absent from the catalogue, so no plan can withhold it.
     */
    public function test_the_cheapest_plan_can_still_run_the_venue(): void
    {
        $this->onPlan('starter');
        $token = $this->login();

        foreach ([
            '/api/v1/owner/bookings',
            '/api/v1/owner/courts',
            '/api/v1/owner/customers',
            '/api/v1/owner/payments',
            '/api/v1/owner/refunds',
            '/api/v1/owner/operations',
            '/api/v1/owner/courts/live',
            '/api/v1/owner/dashboard',
        ] as $url) {
            $this->as($token)->getJson($url)->assertOk();
        }
    }

    /**
     * A plan that includes nothing still runs the venue.
     *
     * The failure mode this guards against is the gate defaulting to "deny":
     * a plan whose feature rows are missing or misconfigured must cost the
     * venue its POS, not its ability to take a booking.
     */
    public function test_a_plan_with_no_features_at_all_still_runs_the_venue(): void
    {
        $this->onPlan('starter');
        DB::table('plan_features')->delete();
        PlanFeatures::flush();

        $token = $this->login();
        $this->as($token)->getJson('/api/v1/owner/bookings')->assertOk();
        $this->as($token)->getJson('/api/v1/owner/products')->assertStatus(402);
    }

    // ---- the platform can change what a plan includes ----------------------

    /**
     * The point of the admin screen: the matrix is the operator's to set, and
     * changing it has to take effect without a deploy.
     */
    public function test_turning_a_feature_on_for_a_plan_opens_it_immediately(): void
    {
        $this->onPlan('starter');

        $this->as($this->login())->getJson('/api/v1/owner/products')->assertStatus(402);

        $this->enable('pos', 'starter');

        $this->as($this->login())->getJson('/api/v1/owner/products')->assertOk();
    }

    public function test_turning_a_feature_off_closes_it_immediately(): void
    {
        $this->onPlan('business');

        $this->as($this->login())->getJson('/api/v1/owner/products')->assertOk();

        $this->disable('pos', 'business');

        $this->as($this->login())->getJson('/api/v1/owner/products')->assertStatus(402);
    }

    /** A row switched off is not the same as a row removed. */
    public function test_a_disabled_row_does_not_grant_the_feature(): void
    {
        $this->onPlan('business');
        $planId = Plan::where('code', 'business')->value('id');
        $featureId = DB::table('features')->where('code', 'pos')->value('id');

        DB::table('plan_features')->where('plan_id', $planId)->where('feature_id', $featureId)->update(['enabled' => 0]);
        PlanFeatures::flush();

        $this->as($this->login())->getJson('/api/v1/owner/products')->assertStatus(402);
    }

    // ---- the catalogue describes the product -------------------------------

    /** Things that were sold and never built are gone from the price list. */
    public function test_the_catalogue_has_no_features_without_a_product(): void
    {
        $codes = DB::table('features')->pluck('code')->all();

        foreach (['tournament', 'public_api', 'custom_domain'] as $vapour) {
            $this->assertNotContains($vapour, $codes, "{$vapour} is on the price list with nothing behind it");
        }
    }

    /**
     * Support has to be able to help a venue without buying them an upgrade.
     *
     * Only reachable when the super admin is also staff of that venue — the
     * owner portal resolves the organization from a membership, so a super
     * admin without one never gets this far.
     */
    public function test_a_super_admin_on_the_staff_is_not_stopped_by_a_plan(): void
    {
        $this->onPlan('starter');

        $super = \App\Models\User::where('email', 'super@sanamspace.test')->firstOrFail();
        \App\Models\OrganizationUser::create([
            'organization_id' => $this->org()->id,
            'user_id' => $super->id,
            'role_id' => \App\Models\Role::where('code', 'owner')->value('id'),
            'display_name' => $super->display_name ?? 'Super',
            'status' => 'active',
            'joined_at' => now(),
        ]);

        $this->as($this->loginAs('super@sanamspace.test'))
            ->getJson('/api/v1/owner/products')
            ->assertOk();
    }

    // ---- the admin screen drives it ----------------------------------------

    /** The grid was read-only; the whole point is that it is not. */
    public function test_the_platform_can_switch_a_cell_of_the_matrix(): void
    {
        $this->onPlan('starter');
        $featureId = DB::table('features')->where('code', 'pos')->value('id');
        $planId = Plan::where('code', 'starter')->value('id');

        $this->as($this->login())->getJson('/api/v1/owner/products')->assertStatus(402);

        $this->as($this->loginAs('super@sanamspace.test'))
            ->putJson("/api/v1/admin/features/{$featureId}/plans/{$planId}", ['enabled' => true])
            ->assertOk();

        $this->as($this->login())->getJson('/api/v1/owner/products')->assertOk();

        $this->as($this->loginAs('super@sanamspace.test'))
            ->putJson("/api/v1/admin/features/{$featureId}/plans/{$planId}", ['enabled' => false])
            ->assertOk();

        $this->as($this->login())->getJson('/api/v1/owner/products')->assertStatus(402);
    }

    /** Switching the same cell on twice is not two entitlements. */
    public function test_switching_a_cell_on_twice_is_idempotent(): void
    {
        $featureId = DB::table('features')->where('code', 'pos')->value('id');
        $planId = Plan::where('code', 'starter')->value('id');
        $token = $this->loginAs('super@sanamspace.test');

        $this->as($token)->putJson("/api/v1/admin/features/{$featureId}/plans/{$planId}", ['enabled' => true])->assertOk();
        $this->as($token)->putJson("/api/v1/admin/features/{$featureId}/plans/{$planId}", ['enabled' => true])->assertOk();

        $this->assertSame(1, DB::table('plan_features')->where('plan_id', $planId)->where('feature_id', $featureId)->count());
    }

    /**
     * The other half of operating this: moving a venue between packages.
     *
     * Without it the platform could edit what a plan includes but never put a
     * venue on a different one, so every upgrade meant a hand-written SQL
     * statement.
     */
    public function test_the_platform_can_move_a_venue_between_plans(): void
    {
        $this->onPlan('starter');
        $this->as($this->login())->getJson('/api/v1/owner/products')->assertStatus(402);

        $sub = Subscription::query()->forOrganization($this->org()->id)->firstOrFail();
        $business = Plan::where('code', 'business')->value('id');

        $this->as($this->loginAs('super@sanamspace.test'))
            ->putJson("/api/v1/admin/subscriptions/{$sub->id}/plan", ['planId' => $business])
            ->assertOk();

        $this->as($this->login())->getJson('/api/v1/owner/products')->assertOk();
    }

    /** A downgrade closes the door the same day, in the same way. */
    public function test_moving_a_venue_down_a_plan_takes_the_features_away(): void
    {
        $this->onPlan('business');
        $this->as($this->login())->getJson('/api/v1/owner/products')->assertOk();

        $sub = Subscription::query()->forOrganization($this->org()->id)->firstOrFail();
        $starter = Plan::where('code', 'starter')->value('id');

        $this->as($this->loginAs('super@sanamspace.test'))
            ->putJson("/api/v1/admin/subscriptions/{$sub->id}/plan", ['planId' => $starter])
            ->assertOk();

        $this->as($this->login())->getJson('/api/v1/owner/products')->assertStatus(402);
    }

    /** Pricing is the platform's business, not a venue's. */
    public function test_a_venue_owner_cannot_edit_the_matrix(): void
    {
        $featureId = DB::table('features')->where('code', 'pos')->value('id');
        $planId = Plan::where('code', 'starter')->value('id');

        $this->as($this->login())
            ->putJson("/api/v1/admin/features/{$featureId}/plans/{$planId}", ['enabled' => true])
            ->assertForbidden();
    }

    /** The venue is told what it is on, so the portal can hide the rest. */
    public function test_the_owner_is_told_which_features_its_plan_includes(): void
    {
        $this->onPlan('business');

        $features = $this->as($this->login())->getJson('/api/v1/owner/subscription')->assertOk()->json('data.features');

        $this->assertContains('pos', $features);
        $this->assertNotContains('crm', $features, 'CRM is the tier above');
    }

    // ---- fixtures ----------------------------------------------------------

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    private function onPlan(string $planCode): void
    {
        $plan = Plan::where('code', $planCode)->firstOrFail();

        Subscription::query()->forOrganization($this->org()->id)->forceDelete();
        Subscription::create([
            'organization_id' => $this->org()->id,
            'plan_id' => $plan->id,
            'status' => 'active',
            'started_at' => now()->subMonth(),
            'ends_at' => now()->addMonth(),
        ]);

        PlanFeatures::flush();
    }

    private function enable(string $featureCode, string $planCode): void
    {
        DB::table('plan_features')->insert([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'plan_id' => Plan::where('code', $planCode)->value('id'),
            'feature_id' => DB::table('features')->where('code', $featureCode)->value('id'),
            'enabled' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        PlanFeatures::flush();
    }

    private function disable(string $featureCode, string $planCode): void
    {
        DB::table('plan_features')
            ->where('plan_id', Plan::where('code', $planCode)->value('id'))
            ->where('feature_id', DB::table('features')->where('code', $featureCode)->value('id'))
            ->delete();

        PlanFeatures::flush();
    }

    private function as(string $token): self
    {
        $this->app['auth']->forgetGuards();
        PlanFeatures::flush();

        return $this->withToken($token);
    }

    private function login(): string
    {
        return $this->loginAs('owner@everyday.test');
    }

    private function loginAs(string $email): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/admin/login', ['email' => $email, 'password' => 'password'])->json('token');
    }
}
