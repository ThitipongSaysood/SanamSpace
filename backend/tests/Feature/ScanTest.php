<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\OrganizationSetting;
use App\Models\OrganizationUser;
use App\Models\Product;
use App\Models\Reward;
use App\Models\RewardRedemption;
use App\Models\Role;
use App\Models\User;
use App\Services\PointsService;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * The counter's one scanner.
 *
 * Staff used to have to know which menu to open before they knew what they were
 * holding. Now they scan whatever the customer holds up, so what matters is the
 * routing: recognise both kinds of code, refuse anything else clearly, and —
 * the part that would be easy to get wrong — never become a way around the role
 * that guards each action on its own.
 */
class ScanTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);

        OrganizationSetting::query()->updateOrCreate(
            ['organization_id' => $this->org()->id],
            ['points_enabled' => true, 'self_redeem_enabled' => true],
        );

        // The scanner checks people into a booking built around "now".
        $this->freezeVenueClockAtMidday($this->org()->id);
    }

    // ---- what a scan can be ------------------------------------------------

    public function test_scanning_a_booking_token_checks_the_customer_in(): void
    {
        $booking = $this->bookingNow();

        $this->as($this->login('owner@everyday.test'))
            ->postJson('/api/v1/owner/scan', ['code' => $booking->checkin_token])
            ->assertOk()
            ->assertJsonPath('kind', 'checkin')
            ->assertJsonPath('ok', true)
            ->assertJsonPath('booking.code', $booking->code);

        $this->assertNotNull($booking->fresh()->checked_in_at);
    }

    public function test_scanning_a_collection_code_hands_the_reward_over(): void
    {
        $redemption = $this->pendingRedemption();

        $this->as($this->login('owner@everyday.test'))
            ->postJson('/api/v1/owner/scan', ['code' => $redemption->code])
            ->assertOk()
            ->assertJsonPath('kind', 'reward')
            ->assertJsonPath('ok', true)
            ->assertJsonPath('reward.name', 'น้ำเปล่า 1 ขวด');

        $this->assertSame('collected', $redemption->fresh()->status);
    }

    /** Typed off a phone screen when the camera will not focus. */
    public function test_a_collection_code_is_matched_regardless_of_case(): void
    {
        $redemption = $this->pendingRedemption();

        $this->as($this->login('owner@everyday.test'))
            ->postJson('/api/v1/owner/scan', ['code' => strtolower($redemption->code)])
            ->assertOk()
            ->assertJsonPath('kind', 'reward')
            ->assertJsonPath('ok', true);
    }

    /** Scanning the same reward twice is a mistake, not a second bottle. */
    public function test_a_reward_already_handed_over_says_so_instead_of_giving_another(): void
    {
        $redemption = $this->pendingRedemption();
        $token = $this->login('owner@everyday.test');

        $this->as($token)->postJson('/api/v1/owner/scan', ['code' => $redemption->code])->assertOk();

        $this->as($token)
            ->postJson('/api/v1/owner/scan', ['code' => $redemption->code])
            ->assertOk()
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'already_collected');
    }

    /** A snack wrapper's barcode, another venue's QR, a typo: same answer. */
    public function test_an_unrecognised_code_is_neither_kind(): void
    {
        $this->as($this->login('owner@everyday.test'))
            ->postJson('/api/v1/owner/scan', ['code' => 'NOPE123'])
            ->assertNotFound()
            ->assertJsonPath('kind', 'unknown');
    }

    /** One venue's scanner must not close another venue's promise. */
    public function test_it_will_not_read_another_venues_code(): void
    {
        $redemption = $this->pendingRedemption(Organization::where('slug', '!=', 'everyday-badminton')->firstOrFail());

        $this->as($this->login('owner@everyday.test'))
            ->postJson('/api/v1/owner/scan', ['code' => $redemption->code])
            ->assertNotFound();

        $this->assertSame('pending', $redemption->fresh()->status);
    }

    // ---- the scanner is not a skeleton key ---------------------------------

    /**
     * Why the permission is checked per branch instead of on the route: a role
     * that may check people in must not gain "hand out rewards" by scanning
     * instead of clicking.
     */
    public function test_a_role_without_crm_rights_cannot_hand_out_rewards_by_scanning(): void
    {
        $redemption = $this->pendingRedemption();
        $staff = $this->staff('reception');

        $this->as($this->login($staff->email))
            ->postJson('/api/v1/owner/scan', ['code' => $redemption->code])
            ->assertForbidden()
            ->assertJsonPath('kind', 'reward');

        $this->assertSame('pending', $redemption->fresh()->status, 'the promise is still owed');
    }

    /** And the reverse: a marketing login must not check people in. */
    public function test_a_role_without_check_in_rights_cannot_check_in_by_scanning(): void
    {
        $booking = $this->bookingNow();
        $staff = $this->staff('marketing');

        $this->as($this->login($staff->email))
            ->postJson('/api/v1/owner/scan', ['code' => $booking->checkin_token])
            ->assertForbidden()
            ->assertJsonPath('kind', 'checkin');

        $this->assertNull($booking->fresh()->checked_in_at);
    }

    // ---- fixtures ----------------------------------------------------------

    private function as(string $token): self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    private function login(string $email): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => $email,
            'password' => 'password',
        ])->json('token');
    }

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    private function staff(string $roleCode): User
    {
        $user = User::create([
            'name' => "staff-{$roleCode}",
            'display_name' => "staff-{$roleCode}",
            'email' => "{$roleCode}@scan.test",
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

    /** A confirmed booking happening right now, so the check-in window is open. */
    private function bookingNow(): Booking
    {
        $org = $this->org();
        $court = $org->courts()->firstOrFail();
        $local = Carbon::now($org->settings?->timezone ?: 'Asia/Bangkok');

        return Booking::create([
            'organization_id' => $org->id,
            'branch_id' => $court->branch_id,
            'court_id' => $court->id,
            'customer_id' => Customer::query()->forOrganization($org->id)->firstOrFail()->id,
            'code' => 'BKSCAN'.random_int(1000, 9999),
            'date' => $local->toDateString(),
            'start' => $local->copy()->subMinutes(10)->format('H:i'),
            'end' => $local->copy()->addHour()->format('H:i'),
            'amount' => 300,
            'status' => 'confirmed',
            'channel' => 'application',
        ]);
    }

    /** A reward redeemed in the app and still waiting at the counter. */
    private function pendingRedemption(?Organization $org = null): RewardRedemption
    {
        $org ??= $this->org();

        $customer = Customer::create([
            'organization_id' => $org->id,
            'display_name' => 'คุณสแกน',
            'line_user_id' => 'Uscan'.$org->id,
        ]);

        Membership::create([
            'organization_id' => $org->id,
            'customer_id' => $customer->id,
            'tier' => 'Gold',
            'member_id' => 'SM-SCAN'.random_int(100, 999),
            'points' => 500,
            'lifetime_points' => 500,
            'expires_on' => now()->addYear(),
        ]);

        $product = Product::create([
            'organization_id' => $org->id,
            'name' => 'น้ำเปล่า 600ml',
            'price' => 15,
            'stock_qty' => 10,
            'is_active' => true,
        ]);

        $reward = Reward::create([
            'organization_id' => $org->id,
            'name' => 'น้ำเปล่า 1 ขวด',
            'points_cost' => 50,
            'type' => 'product',
            'product_id' => $product->id,
            'is_active' => true,
        ]);

        return app(PointsService::class)->redeem($customer, $reward, null, collectLater: true);
    }
}
