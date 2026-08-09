<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\CustomerPackage;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\OrganizationSetting;
use App\Models\PointTransaction;
use App\Models\Product;
use App\Models\Reward;
use App\Models\RewardRedemption;
use App\Models\Wallet;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * What points are worth.
 *
 * The venue's example was "50 คะแนน แลกน้ำ", so a reward points at a POS
 * product — and the same row covers credit and free hours, which were the other
 * two answers.
 *
 * The rule that matters most: points, stock and the record move together. A
 * customer whose points were taken and whose water never left the fridge is
 * worse off than one who was refused.
 */
class RewardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);

        OrganizationSetting::query()->updateOrCreate(
            ['organization_id' => $this->org()->id],
            [
                'points_enabled' => true,
                'points_per_booking' => 10,
                // A short ladder so 100 lifetime points really is Gold — the
                // tier is recomputed from lifetime, so a fixture cannot just
                // declare one.
                'tier_thresholds' => ['Silver' => 0, 'Gold' => 100, 'Platinum' => 1000],
            ],
        );
    }

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
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

    private function customerToken(): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => 'Ureward',
            'displayName' => 'คุณแลกของ',
        ])->json('token');
    }

    /**
     * The customer, creating them if no login has yet.
     *
     * Most of these tests never sign the customer in — they only need someone
     * with points — so the row has to exist without a login having made it.
     */
    private function customer(): Customer
    {
        return Customer::firstOrCreate(
            ['organization_id' => $this->org()->id, 'line_user_id' => 'Ureward'],
            ['display_name' => 'คุณแลกของ'],
        );
    }

    /** Give the customer points to spend, without going through a booking. */
    private function givePoints(int $points): Membership
    {
        $c = $this->customer();

        return Membership::updateOrCreate(
            ['customer_id' => $c->id],
            [
                'organization_id' => $c->organization_id,
                'tier' => 'Gold',
                'member_id' => 'SM-REWARD',
                'points' => $points,
                'lifetime_points' => $points,
                'expires_on' => now()->addYear(),
            ],
        );
    }

    private function water(int $stock = 10): Product
    {
        return Product::create([
            'organization_id' => $this->org()->id,
            'name' => 'น้ำเปล่า 600ml',
            'price' => 15,
            'stock_qty' => $stock,
            'is_active' => true,
        ]);
    }

    private function reward(array $attrs = []): Reward
    {
        return Reward::create(array_merge([
            'organization_id' => $this->org()->id,
            'name' => 'น้ำเปล่า 1 ขวด',
            'points_cost' => 50,
            'type' => 'product',
            'product_id' => $this->water()->id,
        ], $attrs));
    }

    // ---- the venue's example ----------------------------------------------

    /** 50 คะแนน แลกน้ำ — points down, one bottle off the shelf. */
    public function test_fifty_points_buys_a_bottle_of_water(): void
    {
        $product = $this->water(stock: 10);
        $reward = $this->reward(['product_id' => $product->id]);
        $this->givePoints(80);

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/rewards/{$reward->id}/redeem", ['customerId' => $this->customer()->id])
            ->assertCreated()
            ->assertJsonPath('data.pointsSpent', 50);

        $this->assertSame(30, (int) Membership::where('customer_id', $this->customer()->id)->value('points'));
        $this->assertSame(9, (int) $product->fresh()->stock_qty, 'the bottle left the fridge');
    }

    /** Not enough points is a refusal with the shortfall, not a negative balance. */
    public function test_too_few_points_is_refused(): void
    {
        $reward = $this->reward();
        $this->givePoints(20);

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/rewards/{$reward->id}/redeem", ['customerId' => $this->customer()->id])
            ->assertStatus(422);

        $this->assertSame(20, (int) Membership::where('customer_id', $this->customer()->id)->value('points'));
    }

    /**
     * The one that matters: an empty fridge refuses instead of charging.
     *
     * Taking the points and handing over nothing is the worst outcome here.
     */
    public function test_an_out_of_stock_reward_charges_nothing(): void
    {
        $product = $this->water(stock: 0);
        $reward = $this->reward(['product_id' => $product->id]);
        $this->givePoints(100);

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/rewards/{$reward->id}/redeem", ['customerId' => $this->customer()->id])
            ->assertStatus(422);

        $this->assertSame(100, (int) Membership::where('customer_id', $this->customer()->id)->value('points'));
        $this->assertSame(0, RewardRedemption::count());
        $this->assertSame(0, PointTransaction::where('source', 'redemption')->count());
    }

    /** A reward switched off is not redeemable. */
    public function test_an_inactive_reward_cannot_be_redeemed(): void
    {
        $reward = $this->reward(['is_active' => false]);
        $this->givePoints(100);

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/rewards/{$reward->id}/redeem", ['customerId' => $this->customer()->id])
            ->assertStatus(422);
    }

    // ---- the other two reward kinds ---------------------------------------

    /** Points → credit, which is the baht balance the venue already has. */
    public function test_points_can_buy_credit(): void
    {
        $reward = $this->reward([
            'name' => 'เครดิต ฿100', 'type' => 'credit', 'product_id' => null,
            'points_cost' => 200, 'credit_amount' => 100,
        ]);
        $this->givePoints(500);

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/rewards/{$reward->id}/redeem", ['customerId' => $this->customer()->id])
            ->assertCreated();

        $this->assertSame(300, (int) Membership::where('customer_id', $this->customer()->id)->value('points'));
        $this->assertSame(100.0, (float) Wallet::where('customer_id', $this->customer()->id)->value('balance'));
    }

    /** Points → free court time, as a package worth nothing in revenue. */
    public function test_points_can_buy_free_hours(): void
    {
        $reward = $this->reward([
            'name' => 'เล่นฟรี 1 ชม.', 'type' => 'hours', 'product_id' => null,
            'points_cost' => 300, 'hours' => 1,
        ]);
        $this->givePoints(300);

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/rewards/{$reward->id}/redeem", ['customerId' => $this->customer()->id])
            ->assertCreated();

        $package = CustomerPackage::where('customer_id', $this->customer()->id)->firstOrFail();

        $this->assertSame(1.0, (float) $package->remaining_hours);
        $this->assertSame(0.0, (float) $package->price, 'redeemed, not sold — revenue must not count it');
    }

    // ---- what it does to standing ------------------------------------------

    /** Spending must not demote: the tier was earned, and spending is the point. */
    public function test_redeeming_does_not_demote_the_customer(): void
    {
        $reward = $this->reward();
        $this->givePoints(100);

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/rewards/{$reward->id}/redeem", ['customerId' => $this->customer()->id])
            ->assertCreated();

        $membership = Membership::where('customer_id', $this->customer()->id)->firstOrFail();

        $this->assertSame(50, (int) $membership->points);
        $this->assertSame(100, (int) $membership->lifetime_points, 'the ladder does not forget what was earned');
        $this->assertSame('Gold', $membership->tier);
    }

    /** Every redemption is in the ledger, with the staff member who did it. */
    public function test_a_redemption_is_recorded_with_its_staff_member(): void
    {
        $reward = $this->reward();
        $this->givePoints(100);

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/rewards/{$reward->id}/redeem", ['customerId' => $this->customer()->id])
            ->assertCreated();

        $rows = $this->withToken($this->ownerToken())
            ->getJson("/api/v1/owner/customer-credit/{$this->customer()->id}/points")
            ->assertOk()->json('data');

        $this->assertSame(-50, (int) $rows[0]['points']);
        $this->assertSame('redemption', $rows[0]['source']);
        $this->assertSame('Everyday Owner', $rows[0]['byName']);
    }

    /** Repricing a reward must not rewrite what a past redemption cost. */
    public function test_the_cost_is_snapshotted(): void
    {
        $reward = $this->reward();
        $this->givePoints(200);

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/rewards/{$reward->id}/redeem", ['customerId' => $this->customer()->id])
            ->assertCreated();

        $this->withToken($this->ownerToken())
            ->putJson("/api/v1/owner/rewards/{$reward->id}", ['pointsCost' => 500, 'name' => 'ชื่อใหม่'])
            ->assertOk();

        $redemption = RewardRedemption::firstOrFail();

        $this->assertSame(50, (int) $redemption->points_spent);
        $this->assertSame('น้ำเปล่า 1 ขวด', $redemption->name);
    }

    // ---- the price list the customer sees -----------------------------------

    /** A balance means nothing without knowing what it buys. */
    public function test_the_customer_can_see_what_their_points_buy(): void
    {
        $this->reward(['name' => 'น้ำเปล่า 1 ขวด', 'points_cost' => 50]);
        $this->reward(['name' => 'ผ้าเช็ดตัว', 'points_cost' => 500, 'product_id' => $this->water()->id]);

        $token = $this->customerToken();
        $this->givePoints(80);

        $this->app['auth']->forgetGuards();
        $rows = $this->withToken($token)->getJson('/api/v1/rewards')->assertOk()->json('data');

        $cheap = collect($rows)->firstWhere('name', 'น้ำเปล่า 1 ขวด');
        $dear = collect($rows)->firstWhere('name', 'ผ้าเช็ดตัว');

        $this->assertTrue($cheap['affordable']);
        // Said up front rather than letting them walk to the counter to be told no.
        $this->assertFalse($dear['affordable']);
    }

    /** A reward whose product ran out says so, before anyone walks over. */
    public function test_the_customer_list_flags_an_empty_shelf(): void
    {
        $this->reward(['product_id' => $this->water(stock: 0)->id]);

        $token = $this->customerToken();
        $this->givePoints(500);

        $this->app['auth']->forgetGuards();
        $rows = $this->withToken($token)->getJson('/api/v1/rewards')->assertOk()->json('data');

        $this->assertTrue($rows[0]['outOfStock']);
    }

    /** Switched-off rewards are not a price list item. */
    public function test_inactive_rewards_are_not_offered(): void
    {
        $this->reward(['name' => 'ปิดอยู่', 'is_active' => false]);

        $token = $this->customerToken();

        $this->app['auth']->forgetGuards();
        $rows = $this->withToken($token)->getJson('/api/v1/rewards')->assertOk()->json('data');

        $this->assertNotContains('ปิดอยู่', array_column($rows, 'name'));
    }

    // ---- redeeming from the app ---------------------------------------------

    private function allowSelfRedeem(int $collectHours = 48): void
    {
        OrganizationSetting::query()->where('organization_id', $this->org()->id)
            ->update(['self_redeem_enabled' => true, 'redeem_collect_hours' => $collectHours]);
    }

    /** Off until the venue asks: a code nobody expects is worse than no button. */
    public function test_the_app_cannot_redeem_unless_the_venue_allows_it(): void
    {
        $reward = $this->reward();
        $token = $this->customerToken();
        $this->givePoints(100);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/rewards/{$reward->id}/redeem")->assertStatus(422);

        $this->assertSame(100, (int) Membership::where('customer_id', $this->customer()->id)->value('points'));
    }

    /**
     * A product still has to be handed over, so redeeming in the app makes a
     * promise with a code — not a bottle that teleports.
     */
    public function test_redeeming_a_product_in_the_app_issues_a_collection_code(): void
    {
        $this->allowSelfRedeem();
        $product = $this->water(stock: 10);
        $reward = $this->reward(['product_id' => $product->id]);
        $token = $this->customerToken();
        $this->givePoints(100);

        $this->app['auth']->forgetGuards();
        $body = $this->withToken($token)->postJson("/api/v1/rewards/{$reward->id}/redeem")
            ->assertCreated()->json('data');

        $this->assertSame('pending', $body['status']);
        $this->assertNotNull($body['code']);
        $this->assertSame(50, (int) Membership::where('customer_id', $this->customer()->id)->value('points'));
        // The bottle is set aside now — they paid points for THAT one.
        $this->assertSame(9, (int) $product->fresh()->stock_qty);
    }

    /** Credit needs no collecting, so it must not sit in a queue. */
    public function test_redeeming_credit_in_the_app_lands_immediately(): void
    {
        $this->allowSelfRedeem();
        $reward = $this->reward([
            'name' => 'เครดิต ฿50', 'type' => 'credit', 'product_id' => null,
            'points_cost' => 50, 'credit_amount' => 50,
        ]);
        $token = $this->customerToken();
        $this->givePoints(100);

        $this->app['auth']->forgetGuards();
        $body = $this->withToken($token)->postJson("/api/v1/rewards/{$reward->id}/redeem")
            ->assertCreated()->json('data');

        $this->assertSame('collected', $body['status']);
        $this->assertNull($body['code'], 'nothing to collect, so no code to show');
        $this->assertSame(50.0, (float) Wallet::where('customer_id', $this->customer()->id)->value('balance'));
    }

    /** The counter closes the promise with the code off their phone. */
    public function test_staff_collect_it_with_the_code(): void
    {
        $this->allowSelfRedeem();
        $reward = $this->reward();
        $token = $this->customerToken();
        $this->givePoints(100);

        $this->app['auth']->forgetGuards();
        $code = $this->withToken($token)->postJson("/api/v1/rewards/{$reward->id}/redeem")
            ->assertCreated()->json('data.code');

        // Typed by hand off a screen, so case must not matter.
        $this->withToken($this->ownerToken())
            ->postJson('/api/v1/owner/rewards/collect', ['code' => strtolower($code)])
            ->assertOk()
            ->assertJsonPath('data.name', 'น้ำเปล่า 1 ขวด');

        $this->assertSame('collected', RewardRedemption::firstOrFail()->status);
    }

    /** The history must name whoever handed it over, not leave a dash. */
    public function test_the_history_credits_the_staff_who_collected_it(): void
    {
        $this->allowSelfRedeem();
        $reward = $this->reward();
        $token = $this->customerToken();
        $this->givePoints(100);

        $this->app['auth']->forgetGuards();
        $code = $this->withToken($token)->postJson("/api/v1/rewards/{$reward->id}/redeem")->json('data.code');

        $owner = $this->ownerToken();
        $this->withToken($owner)->postJson('/api/v1/owner/rewards/collect', ['code' => $code])->assertOk();

        $row = $this->withToken($owner)->getJson('/api/v1/owner/rewards/redemptions')->assertOk()->json('data.0');

        $this->assertSame('collected', $row['status']);
        $this->assertNotNull($row['byName'], 'nobody redeemed it at the counter, but somebody handed it over');
    }

    /** Handing the same code over twice is a mistake, not a second bottle. */
    public function test_a_code_cannot_be_collected_twice(): void
    {
        $this->allowSelfRedeem();
        $reward = $this->reward();
        $token = $this->customerToken();
        $this->givePoints(100);

        $this->app['auth']->forgetGuards();
        $code = $this->withToken($token)->postJson("/api/v1/rewards/{$reward->id}/redeem")->json('data.code');

        $owner = $this->ownerToken();
        $this->withToken($owner)->postJson('/api/v1/owner/rewards/collect', ['code' => $code])->assertOk();
        $this->withToken($owner)->postJson('/api/v1/owner/rewards/collect', ['code' => $code])->assertStatus(422);
    }

    /** An unknown code says so rather than doing nothing quietly. */
    public function test_an_unknown_code_is_refused(): void
    {
        $this->withToken($this->ownerToken())
            ->postJson('/api/v1/owner/rewards/collect', ['code' => 'RZZZZZ'])
            ->assertStatus(422);
    }

    /**
     * The objection to app redemption, answered: uncollected promises are
     * returned rather than piling up forever.
     */
    public function test_an_uncollected_redemption_returns_the_points_and_the_stock(): void
    {
        $this->allowSelfRedeem(collectHours: 1);
        $product = $this->water(stock: 10);
        $reward = $this->reward(['product_id' => $product->id]);
        $token = $this->customerToken();
        $this->givePoints(100);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/rewards/{$reward->id}/redeem")->assertCreated();

        $this->assertSame(50, (int) Membership::where('customer_id', $this->customer()->id)->value('points'));
        $this->assertSame(9, (int) $product->fresh()->stock_qty);

        // Nobody came.
        RewardRedemption::query()->update(['expires_at' => now()->subHour()]);
        $this->artisan('points:expire')->assertSuccessful();

        $this->assertSame(100, (int) Membership::where('customer_id', $this->customer()->id)->value('points'), 'points came back');
        $this->assertSame(10, (int) $product->fresh()->stock_qty, 'the bottle went back on the shelf');
        $this->assertSame('expired', RewardRedemption::firstOrFail()->status);
    }

    /** Returning points is not earning them — the ladder must not count twice. */
    public function test_a_returned_redemption_does_not_inflate_the_tier(): void
    {
        $this->allowSelfRedeem(collectHours: 1);
        $reward = $this->reward();
        $token = $this->customerToken();
        $this->givePoints(100);
        $before = (int) Membership::where('customer_id', $this->customer()->id)->value('lifetime_points');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/rewards/{$reward->id}/redeem")->assertCreated();

        RewardRedemption::query()->update(['expires_at' => now()->subHour()]);
        $this->artisan('points:expire')->assertSuccessful();

        $this->assertSame(
            $before,
            (int) Membership::where('customer_id', $this->customer()->id)->value('lifetime_points'),
        );
    }

    /** A collected one is never released out from under the customer. */
    public function test_a_collected_redemption_is_left_alone(): void
    {
        $this->allowSelfRedeem(collectHours: 1);
        $reward = $this->reward();
        $token = $this->customerToken();
        $this->givePoints(100);

        $this->app['auth']->forgetGuards();
        $code = $this->withToken($token)->postJson("/api/v1/rewards/{$reward->id}/redeem")->json('data.code');
        $this->withToken($this->ownerToken())->postJson('/api/v1/owner/rewards/collect', ['code' => $code])->assertOk();

        RewardRedemption::query()->update(['expires_at' => now()->subHour()]);
        $this->artisan('points:expire')->assertSuccessful();

        $this->assertSame('collected', RewardRedemption::firstOrFail()->status);
        $this->assertSame(50, (int) Membership::where('customer_id', $this->customer()->id)->value('points'));
    }

    /** The customer can see the code again — a notification scrolls away. */
    public function test_the_customer_can_look_up_their_pending_code(): void
    {
        $this->allowSelfRedeem();
        $reward = $this->reward();
        $token = $this->customerToken();
        $this->givePoints(100);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/rewards/{$reward->id}/redeem")->assertCreated();

        $this->app['auth']->forgetGuards();
        $rows = $this->withToken($token)->getJson('/api/v1/me/redemptions')->assertOk()->json('data');

        $this->assertSame('pending', $rows[0]['status']);
        $this->assertNotNull($rows[0]['code']);
    }

    // ---- scoping and permissions --------------------------------------------

    /** Another venue's reward is not redeemable here. */
    public function test_another_venues_reward_is_unreachable(): void
    {
        $tsr = Organization::where('slug', 'tsr-arena')->firstOrFail();
        $theirs = Reward::create([
            'organization_id' => $tsr->id,
            'name' => 'ของสนามอื่น',
            'points_cost' => 10,
            'type' => 'credit',
            'credit_amount' => 50,
        ]);

        $this->givePoints(500);

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/rewards/{$theirs->id}/redeem", ['customerId' => $this->customer()->id])
            ->assertNotFound();
    }

    /** Handing over value is not a "view the CRM" permission. */
    public function test_redeeming_is_gated(): void
    {
        $reward = $this->reward();
        $this->givePoints(100);

        $user = \App\Models\User::create([
            'name' => 'Viewer', 'display_name' => 'Viewer',
            'email' => 'reward-viewer@everyday.test', 'password' => 'password',
        ]);
        \App\Models\OrganizationUser::create([
            'organization_id' => $this->org()->id,
            'user_id' => $user->id,
            'role_id' => \App\Models\Role::where('code', 'viewer')->value('id'),
            'display_name' => $user->display_name,
            'status' => 'active',
            'joined_at' => now(),
        ]);

        $this->app['auth']->forgetGuards();
        $viewer = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'reward-viewer@everyday.test', 'password' => 'password',
        ])->json('token');

        $this->app['auth']->forgetGuards();
        $this->withToken($viewer)
            ->postJson("/api/v1/owner/rewards/{$reward->id}/redeem", ['customerId' => $this->customer()->id])
            ->assertForbidden();
    }
}
