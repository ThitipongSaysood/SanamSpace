<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\LineProfile;
use App\Models\Organization;
use App\Models\OrganizationSetting;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * The owner API behind the LINE template builder: read the three events, save a
 * block tree, and test-send it to a customer.
 */
class OwnerLineTemplateTest extends TestCase
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

    public function test_index_returns_all_three_events_with_defaults(): void
    {
        $res = $this->withToken($this->ownerToken())->getJson('/api/v1/owner/line-templates')->assertOk();

        $events = collect($res->json('data'))->pluck('event')->all();
        $this->assertEqualsCanonicalizing(
            ['booking_confirmed', 'payment_received', 'booking_cancelled'],
            $events,
        );

        $confirmed = collect($res->json('data'))->firstWhere('event', 'booking_confirmed');
        $this->assertTrue($confirmed['enabled']);         // on by default
        $this->assertNotEmpty($confirmed['blocks']);       // seeded from code default
        $this->assertFalse($confirmed['isCustom']);        // not yet customised
    }

    public function test_saving_a_template_persists_blocks_and_marks_it_custom(): void
    {
        $token = $this->ownerToken();

        $this->withToken($token)->putJson('/api/v1/owner/line-templates/booking_confirmed', [
            'enabled' => true,
            'blocks' => [
                ['type' => 'title', 'text' => '{{venueName}}'],
                ['type' => 'text', 'text' => 'ขอบคุณค่ะ'],
            ],
        ])->assertOk()->assertJsonPath('data.isCustom', true);

        $confirmed = collect(
            $this->withToken($token)->getJson('/api/v1/owner/line-templates')->json('data')
        )->firstWhere('event', 'booking_confirmed');

        $this->assertTrue($confirmed['isCustom']);
        $this->assertCount(2, $confirmed['blocks']);
        $this->assertSame('ขอบคุณค่ะ', $confirmed['blocks'][1]['text']);
    }

    public function test_an_unknown_event_or_bad_block_is_refused(): void
    {
        $token = $this->ownerToken();

        $this->withToken($token)->putJson('/api/v1/owner/line-templates/not_an_event', [
            'enabled' => true, 'blocks' => [],
        ])->assertNotFound();

        $this->withToken($token)->putJson('/api/v1/owner/line-templates/booking_confirmed', [
            'enabled' => true,
            'blocks' => [['type' => 'marquee']], // not an allowed block type
        ])->assertStatus(422);
    }

    public function test_test_send_pushes_the_card_to_a_customer(): void
    {
        Http::fake(['*' => Http::response([], 200)]);
        OrganizationSetting::query()->updateOrCreate(
            ['organization_id' => $this->org()->id],
            ['line_messaging_token' => 'test-token'],
        );

        $customer = Customer::create(['organization_id' => $this->org()->id, 'display_name' => 'เทสต์']);
        LineProfile::create(['customer_id' => $customer->id, 'line_user_id' => 'U'.Str::random(10), 'display_name' => 'เทสต์']);

        $this->withToken($this->ownerToken())
            ->postJson('/api/v1/owner/line-templates/booking_confirmed/test', ['customerId' => $customer->id])
            ->assertOk()
            ->assertJsonPath('data.outcome', 'sent');

        Http::assertSent(fn ($r) => str_contains($r->url(), '/message/push')
            && ($r->data()['messages'][0]['type'] ?? null) === 'flex');
    }

    public function test_test_send_without_a_linked_line_reports_no_profile(): void
    {
        Http::fake(['*' => Http::response([], 200)]);
        OrganizationSetting::query()->updateOrCreate(
            ['organization_id' => $this->org()->id],
            ['line_messaging_token' => 'test-token'],
        );

        $customer = Customer::create(['organization_id' => $this->org()->id, 'display_name' => 'ไม่มีไลน์']);

        $this->withToken($this->ownerToken())
            ->postJson('/api/v1/owner/line-templates/booking_confirmed/test', ['customerId' => $customer->id])
            ->assertStatus(422)
            ->assertJsonPath('data.outcome', 'noProfile');

        Http::assertNothingSent();
    }
}
