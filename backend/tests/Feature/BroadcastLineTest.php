<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Court;
use App\Models\Customer;
use App\Models\CustomerSegment;
use App\Models\LineProfile;
use App\Models\Organization;
use App\Models\OrganizationSetting;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * #4 — a venue's stored LINE messaging token was never used. The Broadcast
 * menu now blasts a promo over LINE to a chosen audience (churned customers,
 * regulars, one-timers, …). These tests prove the token is read, the audience
 * is resolved from booking history, and only LINE-reachable customers get sent.
 */
class BroadcastLineTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;

    private Court $court;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
        config(['broadcast.regular_min_bookings' => 5]);

        $this->org = Organization::where('slug', 'everyday-badminton')->firstOrFail();
        $this->court = Court::where('organization_id', $this->org->id)->firstOrFail();
    }

    private function ownerToken(): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test', 'password' => 'password',
        ])->json('token');
    }

    private function customer(string $name, ?string $lineUserId = null): Customer
    {
        $c = Customer::create(['organization_id' => $this->org->id, 'display_name' => $name]);
        if ($lineUserId) {
            LineProfile::create(['customer_id' => $c->id, 'line_user_id' => $lineUserId]);
        }

        return $c;
    }

    private function booking(Customer $c, string $date): void
    {
        Booking::create([
            'organization_id' => $this->org->id,
            'branch_id' => $this->court->branch_id,
            'court_id' => $this->court->id,
            'customer_id' => $c->id,
            'code' => 'BK'.substr(md5($c->id.$date), 0, 8),
            'date' => $date,
            'start' => '18:00',
            'end' => '19:00',
            'amount' => 250,
            'status' => 'confirmed',
        ]);
    }

    private function setMessagingToken(?string $token): void
    {
        $s = OrganizationSetting::firstOrCreate(['organization_id' => $this->org->id]);
        $s->line_messaging_token = $token;
        $s->save();
    }

    private function preview(string $token, array $params): array
    {
        $qs = http_build_query($params);
        $this->app['auth']->forgetGuards();

        return $this->withToken($token)->getJson("/api/v1/owner/broadcasts/audience-preview?{$qs}")
            ->assertOk()->json();
    }

    public function test_line_broadcast_pushes_only_to_reachable_recipients(): void
    {
        Http::fake(['*' => Http::response(['x' => true], 200)]);
        $this->setMessagingToken('venue-channel-token');

        // A segment of three: two with LINE, one without.
        $a = $this->customer('A', 'Uaaa');
        $b = $this->customer('B', 'Ubbb');
        $noLine = $this->customer('C-noline');

        $segment = CustomerSegment::create([
            'organization_id' => $this->org->id,
            'name' => 'Test Segment',
            'description' => '',
        ]);
        $segment->members()->attach([$a->id, $b->id, $noLine->id]);

        $token = $this->ownerToken();

        $this->app['auth']->forgetGuards();
        $broadcastId = $this->withToken($token)->postJson('/api/v1/owner/broadcasts', [
            'title' => 'โปรวันนี้',
            'message' => 'ลด 20% เฉพาะวันนี้',
            'channel' => 'line',
            'audience' => 'segment',
            'segmentId' => $segment->id,
        ])->assertCreated()->json('data.id');

        $this->app['auth']->forgetGuards();
        $res = $this->withToken($token)->postJson("/api/v1/owner/broadcasts/{$broadcastId}/send")
            ->assertOk()
            ->assertJsonPath('data.status', 'sent')
            ->assertJsonPath('data.recipientCount', 3)      // audience size
            ->assertJsonPath('data.delivery.sent', 2)       // only the two with LINE
            ->assertJsonPath('data.delivery.skipped', 1)
            ->assertJsonPath('data.delivery.noToken', false);

        // The LINE multicast was called with exactly the two reachable ids.
        Http::assertSent(function ($request) {
            return str_contains($request->url(), 'message/multicast')
                && $request['to'] == ['Uaaa', 'Ubbb']
                && $request['messages'][0]['text'] === 'ลด 20% เฉพาะวันนี้';
        });
    }

    public function test_send_without_a_messaging_token_records_but_delivers_nothing(): void
    {
        Http::fake(); // any real call would be caught; we assert none happens
        $this->setMessagingToken(null);

        $withLine = $this->customer('Has LINE', 'Uzzz');
        $segment = CustomerSegment::create(['organization_id' => $this->org->id, 'name' => 'S', 'description' => '']);
        $segment->members()->attach([$withLine->id]);

        $token = $this->ownerToken();
        $this->app['auth']->forgetGuards();
        $id = $this->withToken($token)->postJson('/api/v1/owner/broadcasts', [
            'title' => 'x', 'message' => 'y', 'channel' => 'line',
            'audience' => 'segment', 'segmentId' => $segment->id,
        ])->assertCreated()->json('data.id');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/owner/broadcasts/{$id}/send")
            ->assertOk()
            ->assertJsonPath('data.status', 'sent')
            ->assertJsonPath('data.delivery.noToken', true)
            ->assertJsonPath('data.delivery.sent', 0);

        Http::assertNothingSent();
    }

    public function test_app_channel_drops_a_promo_into_each_customers_bell(): void
    {
        Http::fake(); // in-app delivery must not call LINE at all
        $this->setMessagingToken('ignored-for-app');

        // Two customers, neither needs a LINE profile for in-app delivery.
        $x = $this->customer('X');
        $y = $this->customer('Y');
        $segment = CustomerSegment::create(['organization_id' => $this->org->id, 'name' => 'App Seg', 'description' => '']);
        $segment->members()->attach([$x->id, $y->id]);

        $token = $this->ownerToken();
        $this->app['auth']->forgetGuards();
        $id = $this->withToken($token)->postJson('/api/v1/owner/broadcasts', [
            'title' => 'โปรในแอป',
            'message' => 'รับส่วนลดผ่านแอปวันนี้',
            'channel' => 'app',
            'audience' => 'segment',
            'segmentId' => $segment->id,
        ])->assertCreated()->json('data.id');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/owner/broadcasts/{$id}/send")
            ->assertOk()
            ->assertJsonPath('data.status', 'sent')
            ->assertJsonPath('data.delivery.sent', 2)
            ->assertJsonPath('data.delivery.skipped', 0);

        Http::assertNothingSent();
        foreach ([$x, $y] as $c) {
            $this->assertDatabaseHas('notifications', [
                'customer_id' => $c->id,
                'kind' => 'promo',
                'title' => 'โปรในแอป',
            ]);
        }
    }

    public function test_line_broadcast_with_a_banner_sends_an_image_message_first(): void
    {
        Http::fake(['*' => Http::response(['x' => true], 200)]);
        $this->setMessagingToken('venue-channel-token');

        $a = $this->customer('A', 'Uaaa');
        $segment = CustomerSegment::create(['organization_id' => $this->org->id, 'name' => 'S', 'description' => '']);
        $segment->members()->attach([$a->id]);

        $token = $this->ownerToken();
        $this->app['auth']->forgetGuards();
        $id = $this->withToken($token)->postJson('/api/v1/owner/broadcasts', [
            'title' => 'โปร', 'message' => 'ลด 20%', 'channel' => 'line',
            'imageUrl' => 'https://cdn.example.com/banner.jpg',
            'audience' => 'segment', 'segmentId' => $segment->id,
        ])->assertCreated()->assertJsonPath('data.imageUrl', 'https://cdn.example.com/banner.jpg')->json('data.id');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/owner/broadcasts/{$id}/send")->assertOk();

        Http::assertSent(function ($request) {
            $m = $request['messages'];
            return $m[0]['type'] === 'image'
                && $m[0]['originalContentUrl'] === 'https://cdn.example.com/banner.jpg'
                && $m[1]['type'] === 'text';
        });
    }

    public function test_app_broadcast_with_a_banner_stores_the_image_on_the_notification(): void
    {
        $x = $this->customer('X');
        $segment = CustomerSegment::create(['organization_id' => $this->org->id, 'name' => 'S', 'description' => '']);
        $segment->members()->attach([$x->id]);

        $token = $this->ownerToken();
        $this->app['auth']->forgetGuards();
        $id = $this->withToken($token)->postJson('/api/v1/owner/broadcasts', [
            'title' => 'โปรในแอป', 'message' => 'ดูเลย', 'channel' => 'app',
            'imageUrl' => 'https://cdn.example.com/promo.png',
            'audience' => 'segment', 'segmentId' => $segment->id,
        ])->assertCreated()->json('data.id');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/owner/broadcasts/{$id}/send")->assertOk();

        $this->assertDatabaseHas('notifications', [
            'customer_id' => $x->id,
            'kind' => 'promo',
            'image_url' => 'https://cdn.example.com/promo.png',
        ]);
    }

    public function test_a_draft_can_be_edited_but_a_sent_broadcast_cannot(): void
    {
        $token = $this->ownerToken();

        $this->app['auth']->forgetGuards();
        $id = $this->withToken($token)->postJson('/api/v1/owner/broadcasts', [
            'title' => 'ร่างแรก', 'message' => 'ข้อความ', 'channel' => 'app', 'audience' => 'all',
        ])->assertCreated()->json('data.id');

        // Edit the draft.
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->putJson("/api/v1/owner/broadcasts/{$id}", [
            'title' => 'แก้แล้ว', 'message' => 'ใหม่', 'channel' => 'app', 'audience' => 'all',
        ])->assertOk()->assertJsonPath('data.title', 'แก้แล้ว')->assertJsonPath('data.message', 'ใหม่');

        // Send it, then editing is refused.
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/owner/broadcasts/{$id}/send")->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->putJson("/api/v1/owner/broadcasts/{$id}", [
            'title' => 'อีกที', 'message' => 'x', 'channel' => 'app', 'audience' => 'all',
        ])->assertStatus(422);
    }

    public function test_a_broadcast_can_be_deleted(): void
    {
        $token = $this->ownerToken();

        $this->app['auth']->forgetGuards();
        $id = $this->withToken($token)->postJson('/api/v1/owner/broadcasts', [
            'title' => 'ลบฉัน', 'message' => 'x', 'channel' => 'app', 'audience' => 'all',
        ])->assertCreated()->json('data.id');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->deleteJson("/api/v1/owner/broadcasts/{$id}")
            ->assertOk()->assertJsonPath('deleted', true);

        // Gone from the list.
        $this->app['auth']->forgetGuards();
        $ids = collect($this->withToken($token)->getJson('/api/v1/owner/broadcasts')->json('data'))->pluck('id');
        $this->assertNotContains($id, $ids);
    }

    public function test_lost_audience_counts_only_churned_customers(): void
    {
        $token = $this->ownerToken();
        $base = $this->preview($token, ['audience' => 'lost', 'inactiveDays' => 30])['recipientCount'];

        // Booked 60 days ago and never since → churned.
        $lost = $this->customer('Lost', 'Ulost');
        $this->booking($lost, now()->subDays(60)->toDateString());

        // Booked today → active, must NOT count as lost.
        $active = $this->customer('Active', 'Uactive');
        $this->booking($active, now()->toDateString());

        $after = $this->preview($token, ['audience' => 'lost', 'inactiveDays' => 30]);
        $this->assertSame($base + 1, $after['recipientCount']);
        $this->assertSame($base + 1, $after['reachableCount']); // the lost one has LINE
    }

    public function test_one_time_and_regulars_audiences(): void
    {
        $token = $this->ownerToken();
        $oneBase = $this->preview($token, ['audience' => 'one_time'])['recipientCount'];
        $regBase = $this->preview($token, ['audience' => 'regulars'])['recipientCount'];

        // Exactly one booking → one-timer, not a regular.
        $once = $this->customer('Once');
        $this->booking($once, now()->subDays(3)->toDateString());

        // Five bookings → regular, not a one-timer.
        $regular = $this->customer('Regular');
        for ($i = 1; $i <= 5; $i++) {
            $this->booking($regular, now()->subDays($i)->toDateString());
        }

        $this->assertSame($oneBase + 1, $this->preview($token, ['audience' => 'one_time'])['recipientCount']);
        $this->assertSame($regBase + 1, $this->preview($token, ['audience' => 'regulars'])['recipientCount']);
    }
}
