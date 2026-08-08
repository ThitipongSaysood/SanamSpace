<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Wallet;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Two things that made every screen say "เกิดข้อผิดพลาด ลองอีกครั้ง".
 *
 * Both are about answering a normal situation with an error: a session that has
 * ended, and a customer who has simply never topped up.
 */
class DeadSessionAndWalletTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function token(): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => 'Uwallet',
            'displayName' => 'คุณกระเป๋าเงิน',
        ])->json('token');
    }

    /**
     * A brand-new customer has no wallet row, and that is not an error.
     *
     * `firstOrFail()` here returned 404, so the app showed "เกิดข้อผิดพลาด"
     * to anyone who had never topped up — which is everyone, at first.
     */
    public function test_a_customer_who_never_topped_up_still_has_a_wallet(): void
    {
        $token = $this->token();

        $this->assertSame(
            0,
            Wallet::where('customer_id', Customer::where('line_user_id', 'Uwallet')->value('id'))->count(),
            'precondition: no wallet row yet',
        );

        $body = $this->withToken($token)->getJson('/api/v1/wallet')->assertOk()->json('data');

        $this->assertSame(0.0, (float) $body['balance']);
        $this->assertSame([], $body['transactions']);
    }

    /** Reading it twice must not leave two wallets behind. */
    public function test_reading_the_wallet_twice_creates_only_one(): void
    {
        $token = $this->token();

        $this->withToken($token)->getJson('/api/v1/wallet')->assertOk();
        $this->withToken($token)->getJson('/api/v1/wallet')->assertOk();

        $this->assertSame(
            1,
            Wallet::where('customer_id', Customer::where('line_user_id', 'Uwallet')->value('id'))->count(),
        );
    }

    /** Topping up is often the first thing they do, before any wallet exists. */
    public function test_a_first_top_up_does_not_need_an_existing_wallet(): void
    {
        $token = $this->token();

        $this->withToken($token)->postJson('/api/v1/wallet/topup', ['amount' => 500])->assertOk();
    }

    /**
     * A revoked token is 401, not 200 — this is what the frontend now keys on
     * to send someone back to the login screen instead of telling them to retry.
     */
    public function test_a_revoked_token_is_rejected(): void
    {
        $token = $this->token();
        $this->withToken($token)->getJson('/api/v1/wallet')->assertOk();

        // What a database reset does to every session that was open at the time.
        $this->app['auth']->forgetGuards();
        \Laravel\Sanctum\PersonalAccessToken::query()->delete();

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/wallet')->assertUnauthorized();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/bookings')->assertUnauthorized();
    }
}
