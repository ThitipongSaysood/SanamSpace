<?php

namespace Tests\Feature;

use App\Models\Feature;
use App\Models\Plan;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The public /plans endpoint is what the marketing pricing page reads. Its whole
 * point is that a feature toggled in the admin Feature Matrix (the plan_features
 * pivot) shows or hides on the landing cards with no code change — so these tests
 * assert the response is a live projection of the pivot, not a static list.
 */
class PublicPlansTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    public function test_it_lists_active_plans_cheapest_first_with_limits_and_feature_codes(): void
    {
        $res = $this->getJson('/api/v1/plans');

        $res->assertOk();
        $codes = collect($res->json('data'))->pluck('code');
        $this->assertEquals(['starter', 'business', 'pro'], $codes->all());

        $res->assertJsonStructure([
            'data' => [['code', 'name', 'price', 'interval', 'limits' => ['branchLimit', 'courtLimit'], 'featureCodes']],
        ]);
    }

    public function test_feature_codes_match_the_plan_feature_matrix(): void
    {
        $plans = collect($this->getJson('/api/v1/plans')->json('data'))->keyBy('code');

        // Gated features are assigned per the catalogue: Business sells things,
        // Pro adds marketing. Starter has no gated feature (all its bullets are core).
        $this->assertContains('pos', $plans['business']['featureCodes']);
        $this->assertNotContains('crm', $plans['business']['featureCodes']);
        $this->assertContains('crm', $plans['pro']['featureCodes']);
        $this->assertEmpty($plans['starter']['featureCodes']);
    }

    public function test_disabling_a_feature_for_a_plan_removes_it_from_the_endpoint(): void
    {
        $pro = Plan::where('code', 'pro')->firstOrFail();
        $crm = Feature::where('code', 'crm')->firstOrFail();

        // Sanity: it's there before the toggle.
        $before = collect($this->getJson('/api/v1/plans')->json('data'))->firstWhere('code', 'pro');
        $this->assertContains('crm', $before['featureCodes']);

        // Admin turns the CRM cell off for Pro (what FeatureController@setPlan does).
        DB::table('plan_features')->where('plan_id', $pro->id)->where('feature_id', $crm->id)->delete();

        $after = collect($this->getJson('/api/v1/plans')->json('data'))->firstWhere('code', 'pro');
        $this->assertNotContains('crm', $after['featureCodes']);
    }

    public function test_inactive_plans_are_hidden(): void
    {
        Plan::where('code', 'pro')->update(['is_active' => false]);

        $codes = collect($this->getJson('/api/v1/plans')->json('data'))->pluck('code');

        $this->assertNotContains('pro', $codes->all());
    }
}
