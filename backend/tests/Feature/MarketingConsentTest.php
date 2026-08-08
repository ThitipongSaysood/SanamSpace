<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\CustomerSegment;
use App\Models\Organization;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * PDPA: opting out has to actually stop the marketing.
 *
 * The customer app already had a "แจ้งเตือนโปรโมชั่น" toggle before this — wired
 * to `useState(true)` and nothing else. A marketing opt-out that opts nobody out
 * is worse than none at all, so these tests are mostly about the suppression
 * being real, on every audience, not just the one someone remembered.
 */
class MarketingConsentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function as(string $token): self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    private function ownerToken(): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');
    }

    private function customerToken(string $lineId = 'Uconsent', string $name = 'ลูกค้าทดสอบ'): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => $lineId,
            'displayName' => $name,
        ])->json('token');
    }

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    private function preview(string $token, array $params = []): array
    {
        $qs = http_build_query($params + ['audience' => 'all']);

        return $this->as($token)->getJson("/api/v1/owner/broadcasts/audience-preview?{$qs}")
            ->assertOk()
            ->json();
    }

    // --- consent state -----------------------------------------------------

    /** Nobody has been asked yet, and that is not the same as having said no. */
    public function test_consent_starts_unknown_rather_than_assumed(): void
    {
        $this->as($this->customerToken())->getJson('/api/v1/me/consent')
            ->assertOk()
            ->assertJsonPath('data.consent', null)
            ->assertJsonPath('data.unsubscribedAt', null)
            // Not asked yet still means reachable — see the migration note.
            ->assertJsonPath('data.marketingAllowed', true);
    }

    public function test_a_customer_can_give_and_withdraw_consent(): void
    {
        $token = $this->customerToken();

        $this->as($token)->postJson('/api/v1/me/consent', ['granted' => true])
            ->assertOk()
            ->assertJsonPath('data.consent', true)
            ->assertJsonPath('data.marketingAllowed', true);

        // Saying no is an opt-out too, or the toggle would read "off" while
        // broadcasts kept arriving.
        $this->as($token)->postJson('/api/v1/me/consent', ['granted' => false])
            ->assertOk()
            ->assertJsonPath('data.consent', false)
            ->assertJsonPath('data.marketingAllowed', false);
    }

    /** The one-tap opt-out an unsubscribe link needs. */
    public function test_unsubscribe_is_idempotent_and_keeps_the_original_time(): void
    {
        $token = $this->customerToken();

        $first = $this->as($token)->postJson('/api/v1/me/unsubscribe')
            ->assertOk()
            ->assertJsonPath('data.marketingAllowed', false)
            ->json('data.unsubscribedAt');

        $this->assertNotNull($first);

        $again = $this->as($token)->postJson('/api/v1/me/unsubscribe')
            ->assertOk()
            ->json('data.unsubscribedAt');

        // "When did they opt out" is the question a compliance request asks;
        // a second tap must not rewrite the answer.
        $this->assertSame($first, $again);
    }

    public function test_resubscribing_lifts_an_earlier_opt_out(): void
    {
        $token = $this->customerToken();

        $this->as($token)->postJson('/api/v1/me/unsubscribe')->assertOk();
        $this->as($token)->postJson('/api/v1/me/resubscribe')
            ->assertOk()
            ->assertJsonPath('data.marketingAllowed', true)
            ->assertJsonPath('data.consent', true);
    }

    /** These routes take no id, so one customer cannot reach another's consent. */
    public function test_consent_only_ever_touches_the_authenticated_customer(): void
    {
        $a = $this->customerToken('Uaaa', 'ลูกค้า A');
        $b = $this->customerToken('Ubbb', 'ลูกค้า B');

        $this->as($a)->postJson('/api/v1/me/unsubscribe')->assertOk();

        $this->as($b)->getJson('/api/v1/me/consent')
            ->assertOk()
            ->assertJsonPath('data.marketingAllowed', true);
    }

    public function test_consent_requires_a_signed_in_customer(): void
    {
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/me/unsubscribe')->assertUnauthorized();
    }

    // --- suppression: the part that actually matters ------------------------

    /**
     * Every audience, not just the one someone remembered. A new preset added
     * later inherits the filter because it lives on the base query.
     */
    public function test_an_opted_out_customer_is_dropped_from_every_audience(): void
    {
        $org = $this->org();
        $court = $org->courts()->firstOrFail();

        // A customer who qualifies for every preset at once: booked once, long
        // ago, and created recently.
        $token = $this->customerToken('Uoptout', 'ขอไม่รับข่าว');
        $customer = Customer::where('line_user_id', 'Uoptout')->firstOrFail();

        Booking::create([
            'organization_id' => $org->id,
            'branch_id' => $court->branch_id,
            'court_id' => $court->id,
            'customer_id' => $customer->id,
            'code' => 'BKCONSENT1',
            'date' => now()->subYear()->toDateString(),
            'start' => '10:00',
            'end' => '11:00',
            'amount' => 300,
            'status' => 'confirmed',
            'channel' => 'application',
        ]);

        $owner = $this->ownerToken();

        // `lost` and `new` are windowed, so they need their day count.
        $audiences = [
            ['audience' => 'all'],
            ['audience' => 'lost', 'inactiveDays' => 30],
            ['audience' => 'new', 'inactiveDays' => 30],
            ['audience' => 'one_time'],
        ];

        $before = [];
        foreach ($audiences as $params) {
            $before[$params['audience']] = $this->preview($owner, $params)['recipientCount'];
        }

        $this->as($token)->postJson('/api/v1/me/unsubscribe')->assertOk();

        foreach ($audiences as $params) {
            $audience = $params['audience'];
            $after = $this->preview($owner, $params)['recipientCount'];
            $this->assertSame(
                $before[$audience] - 1,
                $after,
                "audience '{$audience}' still counts an unsubscribed customer",
            );
        }
    }

    /** A hand-picked list is exactly where an opt-out would be missed. */
    public function test_a_segment_also_respects_the_opt_out(): void
    {
        $org = $this->org();
        $token = $this->customerToken('Usegment', 'อยู่ในเซกเมนต์');
        $customer = Customer::where('line_user_id', 'Usegment')->firstOrFail();

        $segment = CustomerSegment::create([
            'organization_id' => $org->id,
            'name' => 'กลุ่มทดสอบ',
        ]);
        $segment->members()->attach($customer->id);

        $owner = $this->ownerToken();
        $params = ['audience' => 'segment', 'segmentId' => $segment->id];

        $this->assertSame(1, $this->preview($owner, $params)['recipientCount']);

        $this->as($token)->postJson('/api/v1/me/unsubscribe')->assertOk();

        $this->assertSame(0, $this->preview($owner, $params)['recipientCount']);
    }

    /** Sending must not reach them either — the preview is not the guard. */
    public function test_sending_skips_an_opted_out_customer(): void
    {
        $token = $this->customerToken('Unosend', 'ไม่รับโปร');
        $customer = Customer::where('line_user_id', 'Unosend')->firstOrFail();
        $this->as($token)->postJson('/api/v1/me/unsubscribe')->assertOk();

        $owner = $this->ownerToken();
        $id = $this->as($owner)->postJson('/api/v1/owner/broadcasts', [
            'title' => 'โปรเดือนนี้',
            'message' => 'ลด 20%',
            'channel' => 'app',
            'audience' => 'all',
        ])->assertCreated()->json('data.id');

        $this->as($owner)->postJson("/api/v1/owner/broadcasts/{$id}/send")->assertOk();

        // The in-app channel writes a notification per recipient; theirs must
        // not exist.
        $this->assertDatabaseMissing('notifications', ['customer_id' => $customer->id]);
    }

    /** The owner should see why the audience shrank, not just that it did. */
    public function test_the_preview_reports_how_many_opted_out(): void
    {
        $owner = $this->ownerToken();
        $this->assertSame(0, $this->preview($owner)['suppressedCount']);

        $this->as($this->customerToken('Usupp', 'ขอออก'))->postJson('/api/v1/me/unsubscribe')->assertOk();

        $this->assertSame(1, $this->preview($owner)['suppressedCount']);
    }
}
