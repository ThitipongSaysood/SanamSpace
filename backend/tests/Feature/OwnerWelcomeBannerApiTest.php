<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\WelcomeBanner;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The venue's welcome banners: a list it can grow, order, and switch on and off
 * one by one, reaching its own customers and nobody else's.
 */
class OwnerWelcomeBannerApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function ownerToken(string $email = 'owner@everyday.test'): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => $email,
            'password' => 'password',
        ])->json('token');
    }

    /**
     * Laravel caches the resolved guard user between calls inside one test, so
     * a second withToken() would otherwise stay authenticated as the first.
     */
    private function as(string $token): self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    private function create(string $token, array $body): string
    {
        return $this->as($token)
            ->postJson('/api/v1/owner/welcome-banners', $body)
            ->assertCreated()
            ->json('data.id');
    }

    /** More than one banner, each reaching the customer app in order. */
    public function test_a_venue_can_publish_several_banners(): void
    {
        $token = $this->ownerToken();

        $this->create($token, ['title' => 'ปีใหม่หยุด 31 ธ.ค.']);
        $this->create($token, ['title' => 'โปรชั่วโมงเช้า', 'message' => 'ลด 20%']);

        $banners = $this->getJson('/api/v1/orgs/everyday-badminton/public')
            ->assertOk()
            ->json('welcomeBanners');

        $this->assertCount(2, $banners);
        $this->assertSame('ปีใหม่หยุด 31 ธ.ค.', $banners[0]['title']);
        $this->assertSame('โปรชั่วโมงเช้า', $banners[1]['title']);
    }

    /**
     * The point of the feature: park a banner without losing it. Toggling off
     * must hide it from customers while the venue keeps it in its own list.
     */
    public function test_switching_a_banner_off_hides_it_without_deleting_it(): void
    {
        $token = $this->ownerToken();
        $id = $this->create($token, ['title' => 'สงกรานต์ปิดปรับปรุง']);

        $this->as($token)->postJson("/api/v1/owner/welcome-banners/{$id}/toggle")
            ->assertOk()
            ->assertJsonPath('data.isActive', false);

        $this->assertSame([], $this->getJson('/api/v1/orgs/everyday-badminton/public')->json('welcomeBanners'));

        // Still the venue's own — listed, and switchable back on.
        $this->as($token)->getJson('/api/v1/owner/welcome-banners')
            ->assertOk()
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.isActive', false);

        $this->as($token)->postJson("/api/v1/owner/welcome-banners/{$id}/toggle")
            ->assertOk()
            ->assertJsonPath('data.isActive', true);

        $this->assertCount(1, $this->getJson('/api/v1/orgs/everyday-badminton/public')->json('welcomeBanners'));
    }

    public function test_reordering_changes_what_customers_see_first(): void
    {
        $token = $this->ownerToken();
        $first = $this->create($token, ['title' => 'อันแรก']);
        $second = $this->create($token, ['title' => 'อันสอง']);

        $this->as($token)->postJson('/api/v1/owner/welcome-banners/reorder', [
            'ids' => [$second, $first],
        ])->assertOk();

        $banners = $this->getJson('/api/v1/orgs/everyday-badminton/public')->json('welcomeBanners');
        $this->assertSame('อันสอง', $banners[0]['title']);
        $this->assertSame('อันแรก', $banners[1]['title']);
    }

    /** Only the banners flagged for it should greet arrivals as a popup. */
    public function test_popup_is_a_per_banner_choice(): void
    {
        $token = $this->ownerToken();
        $this->create($token, ['title' => 'อ่านเมื่อว่าง']);
        $this->create($token, ['title' => 'เรื่องด่วน', 'popup' => true]);

        $banners = $this->getJson('/api/v1/orgs/everyday-badminton/public')->json('welcomeBanners');

        $this->assertFalse($banners[0]['popup']);
        $this->assertTrue($banners[1]['popup']);
    }

    /** A card with nothing on it is worse than no card. */
    public function test_an_empty_banner_is_not_shown_to_customers(): void
    {
        $token = $this->ownerToken();
        $this->create($token, ['link' => 'https://example.test']);

        $this->assertSame([], $this->getJson('/api/v1/orgs/everyday-badminton/public')->json('welcomeBanners'));
    }

    /** A banner belonging to another venue, to aim cross-tenant calls at. */
    private function foreignBanner(): WelcomeBanner
    {
        $other = Organization::where('slug', '!=', 'everyday-badminton')->first()
            ?? Organization::create(['name' => 'Other Org', 'slug' => 'other-org']);

        return WelcomeBanner::create([
            'organization_id' => $other->id,
            'title' => 'ของสนามอื่น',
            'sort_order' => 7,
        ]);
    }

    /** Another venue's banner must not be listed, editable, or deletable. */
    public function test_banners_are_scoped_to_their_own_venue(): void
    {
        $foreign = $this->foreignBanner();
        $token = $this->ownerToken();

        $listed = $this->as($token)->getJson('/api/v1/owner/welcome-banners')->assertOk()->json('data');
        $this->assertNotContains($foreign->id, array_column($listed, 'id'));

        $this->as($token)->putJson("/api/v1/owner/welcome-banners/{$foreign->id}", ['title' => 'ยึด'])
            ->assertNotFound();

        $this->as($token)->postJson("/api/v1/owner/welcome-banners/{$foreign->id}/toggle")
            ->assertNotFound();

        $this->as($token)->deleteJson("/api/v1/owner/welcome-banners/{$foreign->id}")
            ->assertNotFound();

        $this->assertDatabaseHas('welcome_banners', ['id' => $foreign->id, 'title' => 'ของสนามอื่น']);
    }

    /** A stale tab must not be able to reshuffle another venue's list. */
    public function test_reorder_ignores_ids_from_another_venue(): void
    {
        $foreign = $this->foreignBanner();

        $this->as($this->ownerToken())
            ->postJson('/api/v1/owner/welcome-banners/reorder', ['ids' => [$foreign->id]])
            ->assertOk();

        $this->assertSame(7, WelcomeBanner::findOrFail($foreign->id)->sort_order);
    }
}
