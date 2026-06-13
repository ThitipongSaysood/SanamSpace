<?php

namespace Tests\Feature;

use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Covers the customer-app extras: reviews, packages, promotions, membership,
 * wallet, notifications, and profile update. Values are asserted against the
 * frontend fixtures (lib/api/fixtures.ts).
 */
class CustomerExtraApiTest extends TestCase
{
    use RefreshDatabase;

    /** The seeded demo customer's LINE id (has membership/wallet/notifications). */
    private const DEMO_LINE_ID = 'U1234567890abcdef1234567890abcdef';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    /** Log in as the seeded demo customer and return the bearer token. */
    private function demoToken(): string
    {
        return $this->postJson('/api/v1/auth/line/login', [
            'lineUserId' => self::DEMO_LINE_ID,
            'displayName' => 'คุณสมชาย',
        ])->json('token');
    }

    public function test_reviews_returns_summary_for_venue(): void
    {
        $response = $this->getJson('/api/v1/reviews?venueId=everyday-badminton')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'average', 'total',
                    'breakdown' => ['1', '2', '3', '4', '5'],
                    'reviews' => [['id', 'author', 'rating', 'date', 'text']],
                ],
            ]);

        $response->assertJsonPath('data.average', 4.8)
            ->assertJsonPath('data.total', 236)
            ->assertJsonPath('data.breakdown.5', 198)
            ->assertJsonPath('data.breakdown.1', 1)
            ->assertJsonCount(2, 'data.reviews')
            ->assertJsonPath('data.reviews.0.author', 'ทานต์');
    }

    public function test_reviews_defaults_to_first_branch_without_venue_id(): void
    {
        $this->getJson('/api/v1/reviews')
            ->assertOk()
            ->assertJsonPath('data.total', 236);
    }

    public function test_packages_returns_three_in_frontend_shape(): void
    {
        $this->getJson('/api/v1/packages')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonStructure(['data' => [['id', 'name', 'hours', 'price', 'validDays', 'savePercent']]])
            ->assertJsonPath('data.0.hours', 10)
            ->assertJsonPath('data.0.savePercent', 15)
            ->assertJsonPath('data.2.price', 10000);
    }

    public function test_promotions_returns_three_in_frontend_shape(): void
    {
        $this->getJson('/api/v1/promotions')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonStructure(['data' => [['id', 'title', 'subtitle', 'tag']]])
            ->assertJsonPath('data.0.tag', 'ส่วนลด')
            ->assertJsonPath('data.1.title', 'Happy Hour');
    }

    public function test_membership_returns_demo_customer_membership(): void
    {
        $this->withToken($this->demoToken())
            ->getJson('/api/v1/membership')
            ->assertOk()
            ->assertJsonStructure(['data' => ['tier', 'memberId', 'points', 'expiresAt', 'benefits']])
            ->assertJsonPath('data.tier', 'Gold')
            ->assertJsonPath('data.memberId', 'ED-0001234')
            ->assertJsonPath('data.points', 820)
            ->assertJsonPath('data.expiresAt', '31 ธ.ค. 2567')
            ->assertJsonCount(3, 'data.benefits');
    }

    public function test_wallet_returns_balance_and_transactions(): void
    {
        $this->withToken($this->demoToken())
            ->getJson('/api/v1/wallet')
            ->assertOk()
            ->assertJsonStructure(['data' => ['balance', 'transactions' => [['id', 'date', 'label', 'amount']]]])
            ->assertJsonPath('data.balance', 580)
            ->assertJsonCount(3, 'data.transactions')
            ->assertJsonPath('data.transactions.0.amount', 500)
            ->assertJsonPath('data.transactions.1.amount', -225);
    }

    public function test_notifications_returns_four_for_demo_customer(): void
    {
        $this->withToken($this->demoToken())
            ->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonCount(4, 'data')
            ->assertJsonStructure(['data' => [['id', 'kind', 'title', 'body', 'timeAgo']]])
            ->assertJsonPath('data.0.kind', 'booking')
            ->assertJsonPath('data.0.timeAgo', 'เมื่อสักครู่')
            ->assertJsonPath('data.3.kind', 'points');
    }

    public function test_update_me_updates_profile_and_returns_user(): void
    {
        $this->withToken($this->demoToken())
            ->putJson('/api/v1/auth/me', [
                'displayName' => 'คุณทดสอบ',
                'phone' => '099-999-9999',
            ])
            ->assertOk()
            ->assertJsonStructure(['data' => ['id', 'displayName', 'lineId', 'email', 'phone']])
            ->assertJsonPath('data.displayName', 'คุณทดสอบ')
            ->assertJsonPath('data.phone', '099-999-9999');

        $this->assertDatabaseHas('customers', [
            'line_user_id' => self::DEMO_LINE_ID,
            'display_name' => 'คุณทดสอบ',
            'phone' => '099-999-9999',
        ]);
    }

    public function test_update_me_validates_email(): void
    {
        $this->withToken($this->demoToken())
            ->putJson('/api/v1/auth/me', ['email' => 'not-an-email'])
            ->assertStatus(422);
    }

    public function test_account_endpoints_require_authentication(): void
    {
        $this->getJson('/api/v1/membership')->assertUnauthorized();
        $this->getJson('/api/v1/wallet')->assertUnauthorized();
        $this->getJson('/api/v1/notifications')->assertUnauthorized();
        $this->putJson('/api/v1/auth/me', ['displayName' => 'x'])->assertUnauthorized();
    }
}
