<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\Organization;
use App\Models\Promotion;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A promotion can carry a coupon so tapping it pre-applies the code. The link
 * is org-scoped and surfaced to the customer only for a live coupon.
 */
class PromotionCouponTest extends TestCase
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

    private function coupon(string $code, bool $active = true): Coupon
    {
        return Coupon::create([
            'organization_id' => $this->org()->id,
            'code' => $code,
            'type' => 'percent',
            'value' => 10,
            'is_active' => $active,
        ]);
    }

    public function test_owner_links_a_coupon_and_it_shows_on_the_promotion(): void
    {
        $coupon = $this->coupon('SAVE10');

        $this->withToken($this->ownerToken())
            ->postJson('/api/v1/owner/promotions', [
                'title' => 'ลด 10%',
                'subtitle' => 'ทุกวันจันทร์',
                'tag' => 'ส่วนลด',
                'couponId' => $coupon->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.couponId', $coupon->id)
            ->assertJsonPath('data.couponCode', 'SAVE10');
    }

    public function test_customer_promotions_expose_the_code_for_a_live_coupon_only(): void
    {
        $live = $this->coupon('LIVE10', active: true);
        $off = $this->coupon('OFF10', active: false);

        Promotion::create(['organization_id' => $this->org()->id, 'title' => 'A', 'tag' => 'ส่วนลด', 'coupon_id' => $live->id, 'sort_order' => 1]);
        Promotion::create(['organization_id' => $this->org()->id, 'title' => 'B', 'tag' => 'ส่วนลด', 'coupon_id' => $off->id, 'sort_order' => 2]);
        Promotion::create(['organization_id' => $this->org()->id, 'title' => 'C', 'tag' => 'แพ็กเกจ', 'sort_order' => 3]);

        $data = collect(
            $this->getJson('/api/v1/promotions?venueId=everyday-badminton')->assertOk()->json('data')
        )->keyBy('title');

        $this->assertSame('LIVE10', $data['A']['couponCode']);   // live → code exposed
        $this->assertNull($data['B']['couponCode']);              // inactive → withheld
        $this->assertNull($data['C']['couponCode']);              // no coupon → announcement
    }

    public function test_a_switched_off_promotion_is_hidden_from_customers(): void
    {
        $on = Promotion::create(['organization_id' => $this->org()->id, 'title' => 'เปิด', 'tag' => 'ส่วนลด', 'is_active' => true, 'sort_order' => 1]);
        $off = Promotion::create(['organization_id' => $this->org()->id, 'title' => 'ปิด', 'tag' => 'ส่วนลด', 'is_active' => true, 'sort_order' => 2]);

        // Owner switches the second one off.
        $this->withToken($this->ownerToken())
            ->putJson("/api/v1/owner/promotions/{$off->id}", ['isActive' => false])
            ->assertOk()->assertJsonPath('data.isActive', false);

        $titles = collect($this->getJson('/api/v1/promotions?venueId=everyday-badminton')->json('data'))->pluck('title');
        $this->assertTrue($titles->contains('เปิด'));
        $this->assertFalse($titles->contains('ปิด'));
    }

    public function test_a_coupon_from_another_org_cannot_be_linked(): void
    {
        $otherOrg = Organization::where('slug', '!=', 'everyday-badminton')->firstOrFail();
        $foreign = Coupon::create(['organization_id' => $otherOrg->id, 'code' => 'FOREIGN', 'type' => 'percent', 'value' => 10]);

        $this->withToken($this->ownerToken())
            ->postJson('/api/v1/owner/promotions', [
                'title' => 'x', 'tag' => 'ส่วนลด', 'couponId' => $foreign->id,
            ])
            ->assertStatus(422);
    }
}
