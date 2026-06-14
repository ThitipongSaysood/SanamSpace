<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SuperAdminApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    /** Bearer token for the seeded platform super admin. */
    private function superToken(): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'super@sanamspace.test',
            'password' => 'password',
        ])->json('token');
    }

    public function test_dashboard_returns_platform_stats(): void
    {
        $this->withToken($this->superToken())
            ->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->assertJsonStructure([
                'totalOrganizations', 'activeSubscriptions', 'totalBookings',
                'totalRevenue', 'totalCustomers', 'mrr',
            ])
            ->assertJsonPath('totalOrganizations', 2)
            ->assertJsonPath('activeSubscriptions', 2)
            ->assertJsonPath('totalCustomers', 1)
            // Pro 3990 + Business 1990.
            ->assertJsonPath('mrr', 5980);
    }

    public function test_organizations_lists_all_orgs_with_plan_and_counts(): void
    {
        $response = $this->withToken($this->superToken())
            ->getJson('/api/v1/admin/organizations')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        // Keyed by slug id for order-independent assertions.
        $orgs = collect($response->json('data'))->keyBy('id');

        $this->assertSame('Pro', $orgs['everyday-badminton']['planName']);
        $this->assertSame('active', $orgs['everyday-badminton']['subscriptionStatus']);
        $this->assertSame(6, $orgs['everyday-badminton']['courtCount']);
        $this->assertSame(1, $orgs['everyday-badminton']['customerCount']);

        $this->assertSame('Business', $orgs['tsr-arena']['planName']);
        $this->assertSame(4, $orgs['tsr-arena']['courtCount']);
    }

    public function test_organization_detail_includes_plan_settings_and_counts(): void
    {
        $this->withToken($this->superToken())
            ->getJson('/api/v1/admin/organizations/everyday-badminton')
            ->assertOk()
            ->assertJsonPath('data.id', 'everyday-badminton')
            ->assertJsonPath('data.plan.code', 'pro')
            ->assertJsonPath('data.subscriptionStatus', 'active')
            ->assertJsonPath('data.counts.courts', 6)
            ->assertJsonPath('data.settings.email', 'contact@everyday.test');
    }

    public function test_subscriptions_lists_all_subscriptions(): void
    {
        $this->withToken($this->superToken())
            ->getJson('/api/v1/admin/subscriptions')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonStructure([
                'data' => [['id', 'organizationName', 'planName', 'price', 'status', 'startedAt', 'endsAt']],
            ]);
    }

    public function test_plans_returns_four_plans_with_limits_and_features(): void
    {
        $response = $this->withToken($this->superToken())
            ->getJson('/api/v1/admin/plans')
            ->assertOk()
            ->assertJsonCount(4, 'data');

        $plans = collect($response->json('data'))->keyBy('code');

        $this->assertEquals(990, $plans['starter']['price']);
        $this->assertEquals(1990, $plans['business']['price']);
        $this->assertEquals(3990, $plans['pro']['price']);
        $this->assertEquals(0, $plans['enterprise']['price']);

        // Starter limits per the Feature Matrix.
        $this->assertSame(1, $plans['starter']['limits']['branchLimit']);
        $this->assertSame(10, $plans['starter']['limits']['courtLimit']);
        // Pro branch limit is unlimited (null).
        $this->assertNull($plans['pro']['limits']['branchLimit']);

        // Starter has no gated features; Pro enables CRM.
        $this->assertSame([], $plans['starter']['featureCodes']);
        $this->assertContains('crm', $plans['pro']['featureCodes']);
    }

    public function test_features_endpoint_returns_features_with_plan_codes(): void
    {
        $response = $this->withToken($this->superToken())
            ->getJson('/api/v1/admin/features')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [['id', 'code', 'name', 'planCodes']],
            ]);

        $features = collect($response->json('data'))->keyBy('code');

        // membership is enabled on business/pro/enterprise but not starter.
        $this->assertContains('business', $features['membership']['planCodes']);
        $this->assertNotContains('starter', $features['membership']['planCodes']);
    }

    public function test_can_create_and_update_a_plan(): void
    {
        $token = $this->superToken();

        $created = $this->withToken($token)->postJson('/api/v1/admin/plans', [
            'code' => 'lite',
            'name' => 'Lite',
            'price' => 490,
            'branchLimit' => 1,
            'courtLimit' => 5,
            'isActive' => true,
        ])->assertCreated()
            ->assertJsonPath('data.code', 'lite')
            ->assertJsonPath('data.price', 490)
            ->assertJsonPath('data.limits.courtLimit', 5);

        $id = $created->json('data.id');

        $this->withToken($token)->putJson("/api/v1/admin/plans/{$id}", [
            'price' => 590,
            'isActive' => false,
        ])->assertOk()
            ->assertJsonPath('data.price', 590)
            ->assertJsonPath('data.isActive', false);
    }

    public function test_settings_persist_security_notification_and_backup_fields(): void
    {
        $token = $this->superToken();

        $this->withToken($token)->putJson('/api/v1/admin/settings', [
            'sessionTimeoutMinutes' => 120,
            'passwordMinLength' => 12,
            'twoFactorRequired' => true,
            'notifyPayment' => false,
            'backupFrequency' => 'daily',
            'backupRetentionDays' => 14,
        ])->assertOk()
            ->assertJsonPath('data.sessionTimeoutMinutes', 120)
            ->assertJsonPath('data.passwordMinLength', 12)
            ->assertJsonPath('data.twoFactorRequired', true)
            ->assertJsonPath('data.notifyPayment', false)
            ->assertJsonPath('data.backupFrequency', 'daily')
            ->assertJsonPath('data.backupRetentionDays', 14);

        // Reloads from DB on a fresh request.
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/admin/settings')
            ->assertOk()
            ->assertJsonPath('data.backupFrequency', 'daily');
    }

    public function test_backup_can_be_created_listed_and_downloaded(): void
    {
        \Illuminate\Support\Facades\Storage::fake('local');
        $token = $this->superToken();

        $created = $this->withToken($token)->postJson('/api/v1/admin/backups')
            ->assertCreated()
            ->json('data');

        $this->assertMatchesRegularExpression('/^backup-\d{8}-\d{6}\.json$/', $created['name']);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/admin/backups')
            ->assertOk()
            ->assertJsonPath('data.0.name', $created['name']);

        $this->app['auth']->forgetGuards();
        $res = $this->withToken($token)->get("/api/v1/admin/backups/{$created['name']}/download")
            ->assertOk();
        // The dump contains real table data.
        $this->assertStringContainsString('organizations', $res->streamedContent());
    }

    public function test_unauthenticated_request_is_unauthorized(): void
    {
        $this->getJson('/api/v1/admin/dashboard')->assertUnauthorized();
    }

    public function test_non_super_admin_is_forbidden(): void
    {
        // Seeded org owner -> authenticated User but not a super admin -> 403.
        $ownerToken = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');

        $this->withToken($ownerToken)
            ->getJson('/api/v1/admin/dashboard')
            ->assertForbidden();

        $this->app['auth']->forgetGuards();

        // Plain User with no super-admin flag -> 403.
        $orphan = User::create([
            'name' => 'Orphan',
            'display_name' => 'Orphan',
            'email' => 'orphan@nowhere.test',
            'password' => Hash::make('password'),
        ]);
        $orphanToken = $orphan->createToken('admin-token')->plainTextToken;

        $this->withToken($orphanToken)
            ->getJson('/api/v1/admin/organizations')
            ->assertForbidden();

        $this->app['auth']->forgetGuards();

        // A customer token (not a staff User) -> 403.
        $customerToken = $this->postJson('/api/v1/auth/line/login', [
            'lineUserId' => 'Usuperadmincust',
            'displayName' => 'Cust',
        ])->json('token');

        $this->app['auth']->forgetGuards();

        $this->withToken($customerToken)
            ->getJson('/api/v1/admin/dashboard')
            ->assertForbidden();
    }
}
