<?php

namespace Tests\Feature;

use App\Models\Court;
use App\Models\Customer;
use App\Models\CustomerPackage;
use App\Models\Organization;
use App\Models\VenuePackage;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The hour packages a venue sells.
 *
 * Customers could browse and buy them from day one; the venue could not add,
 * reprice or retire a single one — the catalogue existed only because the
 * seeder wrote it.
 *
 * Packages are hours, deliberately. Credit is baht and pays for anything; a
 * package is court time bought ahead at a discount, and converting it to money
 * at purchase would hand the discount back.
 */
class VenuePackageTest extends TestCase
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

        $t = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');

        $this->app['auth']->forgetGuards();

        return $t;
    }

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    /** The venue can put a new package on sale. */
    public function test_a_venue_can_add_a_package(): void
    {
        $body = $this->withToken($this->ownerToken())->postJson('/api/v1/owner/packages', [
            'name' => 'แพ็ก 5 ชม.',
            'hours' => 5,
            'price' => 1000,
            'validDays' => 60,
        ])->assertCreated()->json('data');

        $this->assertSame(5.0, (float) $body['hours']);
        $this->assertSame(1000.0, (float) $body['price']);
        $this->assertSame(200.0, (float) $body['pricePerHour']);
    }

    /**
     * The saving is measured against the venue's own cheapest court, not typed
     * in — an advertised "ประหยัด 20%" nobody checked is a claim, not a fact.
     */
    public function test_the_saving_is_computed_from_the_real_court_price(): void
    {
        $rate = (float) Court::query()->forOrganization($this->org()->id)->where('status', 'active')->min('price_per_hour');
        $this->assertSame(250.0, $rate, 'precondition: the seeded court rate');

        $body = $this->withToken($this->ownerToken())->postJson('/api/v1/owner/packages', [
            'name' => 'แพ็ก 10 ชม.',
            'hours' => 10,
            'price' => 2000, // 10 × 250 = 2500 normally
        ])->assertCreated()->json('data');

        $this->assertSame(20, (int) $body['savePercent']);
    }

    /** A package that is not actually cheaper must not claim a saving. */
    public function test_a_package_with_no_saving_advertises_none(): void
    {
        $body = $this->withToken($this->ownerToken())->postJson('/api/v1/owner/packages', [
            'name' => 'ไม่ลด',
            'hours' => 4,
            'price' => 1000, // exactly 4 × 250
        ])->assertCreated()->json('data');

        $this->assertSame(0, (int) $body['savePercent']);
    }

    /** Repricing changes what the next customer pays, not what was already sold. */
    public function test_repricing_does_not_touch_packages_already_bought(): void
    {
        $token = $this->ownerToken();

        $id = $this->withToken($token)->postJson('/api/v1/owner/packages', [
            'name' => 'แพ็ก 10 ชม.', 'hours' => 10, 'price' => 2000,
        ])->assertCreated()->json('data.id');

        $customer = Customer::create([
            'organization_id' => $this->org()->id,
            'display_name' => 'คนซื้อไปแล้ว',
        ]);
        $bought = CustomerPackage::create([
            'organization_id' => $this->org()->id,
            'customer_id' => $customer->id,
            'venue_package_id' => $id,
            'name' => 'แพ็ก 10 ชม.',
            'total_hours' => 10,
            'remaining_hours' => 10,
            'price' => 2000,
            'status' => 'active',
        ]);

        $this->withToken($token)->putJson("/api/v1/owner/packages/{$id}", ['price' => 3000, 'hours' => 8])
            ->assertOk()
            ->assertJsonPath('data.price', 3000);

        $bought->refresh();
        $this->assertSame(10.0, (float) $bought->total_hours, 'a sold package keeps its own hours');
        $this->assertSame(2000.0, (float) $bought->price);
    }

    /** Retiring one must not take its buyers' hours with it. */
    public function test_retiring_a_package_leaves_its_buyers_alone(): void
    {
        $token = $this->ownerToken();

        $id = $this->withToken($token)->postJson('/api/v1/owner/packages', [
            'name' => 'เลิกขาย', 'hours' => 10, 'price' => 2000,
        ])->assertCreated()->json('data.id');

        $customer = Customer::create(['organization_id' => $this->org()->id, 'display_name' => 'ผู้ถือ']);
        CustomerPackage::create([
            'organization_id' => $this->org()->id,
            'customer_id' => $customer->id,
            'venue_package_id' => $id,
            'name' => 'เลิกขาย',
            'total_hours' => 10,
            'remaining_hours' => 6,
            'status' => 'active',
        ]);

        $this->withToken($token)->deleteJson("/api/v1/owner/packages/{$id}")->assertNoContent();

        // Off the shelf...
        $onSale = $this->getJson('/api/v1/packages?venueId=everyday-badminton')->assertOk()->json('data');
        $this->assertNotContains($id, array_column($onSale, 'id'));

        // ...but the hours someone paid for are still theirs.
        $this->assertSame(6.0, (float) CustomerPackage::where('venue_package_id', $id)->value('remaining_hours'));
    }

    /** The venue needs to know how many people hold one before retiring it. */
    public function test_the_list_says_how_many_customers_hold_each_package(): void
    {
        $token = $this->ownerToken();

        $id = $this->withToken($token)->postJson('/api/v1/owner/packages', [
            'name' => 'ยอดนิยม', 'hours' => 10, 'price' => 2000,
        ])->assertCreated()->json('data.id');

        foreach (['ก', 'ข'] as $n) {
            $c = Customer::create(['organization_id' => $this->org()->id, 'display_name' => $n]);
            CustomerPackage::create([
                'organization_id' => $this->org()->id,
                'customer_id' => $c->id,
                'venue_package_id' => $id,
                'name' => 'ยอดนิยม',
                'total_hours' => 10,
                'remaining_hours' => 10,
                'status' => 'active',
            ]);
        }

        $rows = $this->withToken($token)->getJson('/api/v1/owner/packages')->assertOk()->json('data');
        $row = collect($rows)->firstWhere('id', $id);

        $this->assertSame(2, (int) $row['activeHolders']);
    }

    /** A new package is immediately buyable by customers. */
    public function test_a_new_package_appears_in_the_customer_catalogue(): void
    {
        $this->withToken($this->ownerToken())->postJson('/api/v1/owner/packages', [
            'name' => 'ของใหม่', 'hours' => 6, 'price' => 1200,
        ])->assertCreated();

        $this->app['auth']->forgetGuards();
        $onSale = $this->getJson('/api/v1/packages?venueId=everyday-badminton')->assertOk()->json('data');

        $this->assertContains('ของใหม่', array_column($onSale, 'name'));
    }

    /** Another venue's catalogue is not reachable. */
    public function test_another_venues_package_cannot_be_edited(): void
    {
        $tsr = Organization::where('slug', 'tsr-arena')->firstOrFail();
        $theirs = VenuePackage::create([
            'organization_id' => $tsr->id,
            'name' => 'ของสนามอื่น',
            'hours' => 10,
            'price' => 2000,
            'valid_days' => 30,
        ]);

        $this->withToken($this->ownerToken())
            ->putJson("/api/v1/owner/packages/{$theirs->id}", ['price' => 1])
            ->assertNotFound();
    }

    /** Selling packages is not a "view the CRM" permission. */
    public function test_creating_a_package_is_gated(): void
    {
        $user = \App\Models\User::create([
            'name' => 'Viewer', 'display_name' => 'Viewer',
            'email' => 'pkg-viewer@everyday.test', 'password' => 'password',
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
            'email' => 'pkg-viewer@everyday.test', 'password' => 'password',
        ])->json('token');

        $this->app['auth']->forgetGuards();
        $this->withToken($viewer)->postJson('/api/v1/owner/packages', [
            'name' => 'ไม่ควรสร้างได้', 'hours' => 1, 'price' => 1,
        ])->assertForbidden();
    }
}
