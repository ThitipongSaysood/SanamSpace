<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Organization;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AuthLineLoginTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    /** With no channel configured, the dev/test stub trusts lineUserId. */
    public function test_fallback_mode_logs_in_with_line_user_id(): void
    {
        config(['services.line.channel_id' => null]);

        $res = $this->postJson('/api/v1/auth/line/login', [
            'lineUserId' => 'Ufallbacktest',
            'displayName' => 'Fallback Tester',
        ]);

        $res->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'displayName']]);

        $this->assertDatabaseHas('customers', [
            'line_user_id' => 'Ufallbacktest',
            'display_name' => 'Fallback Tester',
        ]);
    }

    /** When a channel is configured, a raw lineUserId is no longer trusted. */
    public function test_real_mode_requires_id_token(): void
    {
        config(['services.line.channel_id' => 'test-channel']);
        Http::fake(); // no LINE call should be needed; guards before HTTP

        $this->postJson('/api/v1/auth/line/login', [
            'lineUserId' => 'Ushouldbeignored',
        ])->assertStatus(422)->assertJsonValidationErrors('idToken');

        $this->assertDatabaseMissing('customers', ['line_user_id' => 'Ushouldbeignored']);
    }

    /** A LINE-verified id_token logs in using the trusted `sub`/profile. */
    public function test_real_mode_logs_in_with_verified_token(): void
    {
        config([
            'services.line.channel_id' => 'test-channel',
            'services.line.verify_url' => 'https://api.line.me/oauth2/v2.1/verify',
        ]);

        Http::fake([
            'api.line.me/*' => Http::response([
                'iss' => 'https://access.line.me',
                'sub' => 'Uverified123',
                'aud' => 'test-channel',
                'name' => 'Verified LINE User',
                'picture' => 'https://example.com/p.jpg',
                'email' => 'verified@example.com',
            ], 200),
        ]);

        $res = $this->postJson('/api/v1/auth/line/login', [
            'idToken' => 'a.real.looking.jwt',
        ]);

        $res->assertOk()
            ->assertJsonPath('user.displayName', 'Verified LINE User');

        $this->assertDatabaseHas('customers', [
            'line_user_id' => 'Uverified123',
            'display_name' => 'Verified LINE User',
            'email' => 'verified@example.com',
        ]);
    }

    /** A token whose audience is a different channel is rejected. */
    public function test_real_mode_rejects_wrong_audience(): void
    {
        config(['services.line.channel_id' => 'test-channel']);

        Http::fake([
            'api.line.me/*' => Http::response([
                'sub' => 'Uattacker',
                'aud' => 'someone-elses-channel',
            ], 200),
        ]);

        $this->postJson('/api/v1/auth/line/login', [
            'idToken' => 'forged.jwt',
        ])->assertStatus(422)->assertJsonValidationErrors('idToken');

        $this->assertDatabaseMissing('customers', ['line_user_id' => 'Uattacker']);
    }

    /** A token LINE refuses to verify is rejected and creates no customer. */
    public function test_real_mode_rejects_failed_verification(): void
    {
        config(['services.line.channel_id' => 'test-channel']);

        Http::fake([
            'api.line.me/*' => Http::response(['error' => 'invalid_request'], 400),
        ]);

        $before = Customer::query()->count();

        $this->postJson('/api/v1/auth/line/login', [
            'idToken' => 'expired.or.bad.jwt',
        ])->assertStatus(422)->assertJsonValidationErrors('idToken');

        $this->assertSame($before, Customer::query()->count());
    }

    /**
     * Per-venue channel: an org with its own line_channel_id verifies against
     * THAT channel even when no global channel is configured.
     */
    public function test_per_org_channel_verifies_against_org_channel(): void
    {
        // No global channel — only the org has one configured.
        config([
            'services.line.channel_id' => null,
            'services.line.verify_url' => 'https://api.line.me/oauth2/v2.1/verify',
        ]);

        // tsr-arena is the NON-default org, so this proves the org drives resolution.
        $org = Organization::where('slug', 'tsr-arena')->firstOrFail();
        $org->settings()->update(['line_channel_id' => 'org-channel-xyz']);

        Http::fake([
            'api.line.me/*' => Http::response([
                'iss' => 'https://access.line.me',
                'sub' => 'Uorgscoped1',
                'aud' => 'org-channel-xyz',
                'name' => 'Org Scoped User',
                'email' => 'orgscoped@example.com',
            ], 200),
        ]);

        $res = $this->postJson('/api/v1/auth/line/login', [
            'idToken' => 'a.real.looking.jwt',
            'organizationSlug' => 'tsr-arena',
        ]);

        $res->assertOk()->assertJsonPath('user.displayName', 'Org Scoped User');

        // The verify call must use the ORG's client_id, not the (unset) global one.
        Http::assertSent(function ($request) {
            return $request->url() === 'https://api.line.me/oauth2/v2.1/verify'
                && $request['client_id'] === 'org-channel-xyz';
        });

        $this->assertDatabaseHas('customers', [
            'organization_id' => $org->id,
            'line_user_id' => 'Uorgscoped1',
        ]);
    }

    /** GET /line-config returns the resolved org's LIFF id. */
    public function test_line_config_returns_org_liff_id(): void
    {
        $org = Organization::where('slug', 'tsr-arena')->firstOrFail();
        $org->settings()->update(['line_liff_id' => '1234567890-abcdABCD']);

        $this->getJson('/api/v1/line-config?organizationSlug=tsr-arena')
            ->assertOk()
            ->assertJson(['liffId' => '1234567890-abcdABCD']);
    }
}
