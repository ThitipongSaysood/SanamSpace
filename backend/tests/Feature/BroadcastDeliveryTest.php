<?php

namespace Tests\Feature;

use App\Models\Broadcast;
use App\Models\BroadcastRecipient;
use App\Models\Customer;
use App\Models\LineProfile;
use App\Models\Organization;
use App\Models\OrganizationSetting;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * What a broadcast actually did, kept.
 *
 * Sending computed a delivery summary, showed it once in the response and threw
 * it away — so "did that promo go out?" had no answer a minute later, and "who
 * have we already messaged" had none at all.
 */
class BroadcastDeliveryTest extends TestCase
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

    /** A customer with a LINE profile is reachable; without one they are not. */
    private function customer(string $name, bool $withLine): Customer
    {
        $customer = Customer::create([
            'organization_id' => $this->org()->id,
            'display_name' => $name,
            'line_user_id' => $withLine ? 'U'.\Illuminate\Support\Str::random(8) : null,
        ]);

        if ($withLine) {
            LineProfile::create([
                'customer_id' => $customer->id,
                'line_user_id' => $customer->line_user_id,
                'display_name' => $name,
            ]);
        }

        return $customer;
    }

    private function draft(string $token, string $channel = 'app'): string
    {
        return $this->withToken($token)->postJson('/api/v1/owner/broadcasts', [
            'title' => 'โปรวันศุกร์',
            'message' => 'ลด 20% ทุกคอร์ท',
            'channel' => $channel,
            'audience' => 'all',
        ])->assertCreated()->json('data.id');
    }

    /** Every targeted person gets a row, so the send is auditable. */
    public function test_sending_records_one_row_per_recipient(): void
    {
        $this->customer('คนที่หนึ่ง', withLine: true);
        $this->customer('คนที่สอง', withLine: true);

        $token = $this->ownerToken();
        $id = $this->draft($token);

        $this->withToken($token)->postJson("/api/v1/owner/broadcasts/{$id}/send")->assertOk();

        $rows = BroadcastRecipient::where('broadcast_id', $id)->get();

        $this->assertGreaterThanOrEqual(2, $rows->count());
        $this->assertSame($rows->count(), (int) Broadcast::find($id)->recipient_count);
        $this->assertTrue($rows->every(fn ($r) => $r->status === 'sent'));
        $this->assertTrue($rows->every(fn ($r) => $r->sent_at !== null));
    }

    /** The summary survives, so reopening it still says what happened. */
    public function test_the_delivery_summary_is_still_there_on_the_next_read(): void
    {
        $this->customer('คนที่หนึ่ง', withLine: true);

        $token = $this->ownerToken();
        $id = $this->draft($token);

        $this->withToken($token)->postJson("/api/v1/owner/broadcasts/{$id}/send")->assertOk();

        // A fresh read, the way reopening the screen would.
        $row = collect($this->withToken($token)->getJson('/api/v1/owner/broadcasts')->json('data'))
            ->firstWhere('id', $id);

        $this->assertNotNull($row['delivery'], 'the summary must outlive the send response');
        $this->assertGreaterThan(0, $row['delivery']['sent']);
    }

    /** A marketing message has an author, and that was not recorded at all. */
    public function test_who_pressed_send_is_recorded(): void
    {
        $this->customer('คนที่หนึ่ง', withLine: true);

        $token = $this->ownerToken();
        $id = $this->draft($token);

        $this->withToken($token)->postJson("/api/v1/owner/broadcasts/{$id}/send")->assertOk();

        $this->assertNotNull(Broadcast::find($id)->sent_by);
    }

    /**
     * "Cannot reach them" and "something is broken" must stay separate — rolled
     * together, a dead LINE token looks like a quiet audience.
     */
    public function test_unreachable_and_failed_are_recorded_differently(): void
    {
        OrganizationSetting::query()
            ->updateOrCreate(['organization_id' => $this->org()->id], ['line_messaging_token' => 'test-token']);

        $reachable = $this->customer('มีไลน์', withLine: true);
        $unreachable = $this->customer('ไม่มีไลน์', withLine: false);

        Http::fake(['*' => Http::response([], 200)]);

        $token = $this->ownerToken();
        $id = $this->draft($token, 'line');

        $this->withToken($token)->postJson("/api/v1/owner/broadcasts/{$id}/send")->assertOk();

        $this->assertSame(
            'sent',
            BroadcastRecipient::where('broadcast_id', $id)->where('customer_id', $reachable->id)->value('status'),
        );
        $this->assertSame(
            'skipped',
            BroadcastRecipient::where('broadcast_id', $id)->where('customer_id', $unreachable->id)->value('status'),
        );
    }

    /** When LINE refuses, that is a failure and has to look like one. */
    public function test_a_provider_error_is_recorded_as_failed(): void
    {
        OrganizationSetting::query()
            ->updateOrCreate(['organization_id' => $this->org()->id], ['line_messaging_token' => 'test-token']);

        $reachable = $this->customer('มีไลน์', withLine: true);

        Http::fake(['*' => Http::response(['message' => 'invalid token'], 401)]);

        $token = $this->ownerToken();
        $id = $this->draft($token, 'line');

        $this->withToken($token)->postJson("/api/v1/owner/broadcasts/{$id}/send")->assertOk();

        $row = BroadcastRecipient::where('broadcast_id', $id)->where('customer_id', $reachable->id)->first();

        $this->assertSame('failed', $row->status);
        $this->assertNull($row->sent_at, 'nothing was sent, so there is no sent time');
        $this->assertNotNull($row->reason);
    }

    /** No token configured is "we cannot reach anyone", not a failure. */
    public function test_a_venue_with_no_line_token_records_everyone_as_skipped(): void
    {
        $this->customer('มีไลน์', withLine: true);

        $token = $this->ownerToken();
        $id = $this->draft($token, 'line');

        $this->withToken($token)->postJson("/api/v1/owner/broadcasts/{$id}/send")->assertOk();

        $rows = BroadcastRecipient::where('broadcast_id', $id)->get();

        $this->assertTrue($rows->isNotEmpty());
        $this->assertTrue($rows->every(fn ($r) => $r->status === 'skipped'));
    }

    /** Someone who opted out is not in the audience, so gets no row at all. */
    public function test_an_unsubscribed_customer_is_never_recorded_as_a_recipient(): void
    {
        $optedOut = $this->customer('ขอไม่รับ', withLine: true);
        $optedOut->update(['unsubscribed_at' => now()]);

        $token = $this->ownerToken();
        $id = $this->draft($token);

        $this->withToken($token)->postJson("/api/v1/owner/broadcasts/{$id}/send")->assertOk();

        $this->assertSame(
            0,
            BroadcastRecipient::where('broadcast_id', $id)->where('customer_id', $optedOut->id)->count(),
        );
    }
}
