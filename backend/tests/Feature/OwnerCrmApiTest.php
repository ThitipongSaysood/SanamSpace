<?php

namespace Tests\Feature;

use App\Models\Broadcast;
use App\Models\Customer;
use App\Models\CustomerSegment;
use App\Models\Organization;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Covers the Owner Portal CRM domain (overview, segments, timeline, broadcasts).
 * All routes are under the auth:sanctum + owner.org `/owner` group and org-scoped
 * to the authed staff user's org (seeded Everyday Badminton owner).
 */
class OwnerCrmApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function ownerToken(): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');
    }

    private function customerToken(string $lineUserId = 'Ucrm', string $name = 'CRM Cust'): string
    {
        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => $lineUserId,
            'displayName' => $name,
        ])->json('token');
    }

    private function demoCustomerId(): string
    {
        return Customer::where('display_name', 'คุณสมชาย')->firstOrFail()->id;
    }

    public function test_crm_overview_returns_summary(): void
    {
        $this->withToken($this->ownerToken())->getJson('/api/v1/owner/crm/overview')
            ->assertOk()
            ->assertJsonStructure([
                'totalCustomers', 'newCustomers30d', 'inactive30d', 'vipCount',
                'segmentDistribution' => [['name', 'count']],
            ])
            // Seed: 1 demo customer in Everyday, in the VIP segment.
            ->assertJsonPath('totalCustomers', 1)
            ->assertJsonPath('vipCount', 1)
            // Demo customer created "now" -> counts as new; has no booking -> inactive.
            ->assertJsonPath('newCustomers30d', 1)
            ->assertJsonPath('inactive30d', 1)
            ->assertJsonCount(3, 'segmentDistribution');
    }

    public function test_segments_list_and_create_and_delete(): void
    {
        $owner = $this->ownerToken();

        // Seeded with 3 segments.
        $this->withToken($owner)->getJson('/api/v1/owner/segments')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonStructure(['data' => [['id', 'name', 'description', 'memberCount']]]);

        // Create.
        $this->app['auth']->forgetGuards();
        $created = $this->withToken($owner)->postJson('/api/v1/owner/segments', [
            'name' => 'ทดสอบ',
        ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'ทดสอบ')
            ->assertJsonPath('data.memberCount', 0);
        $id = $created->json('data.id');

        // Now 4.
        $this->app['auth']->forgetGuards();
        $this->withToken($owner)->getJson('/api/v1/owner/segments')
            ->assertOk()->assertJsonCount(4, 'data');

        // Delete.
        $this->app['auth']->forgetGuards();
        $this->withToken($owner)->deleteJson("/api/v1/owner/segments/{$id}")
            ->assertNoContent();

        $this->app['auth']->forgetGuards();
        $this->withToken($owner)->getJson('/api/v1/owner/segments')
            ->assertOk()->assertJsonCount(3, 'data');
    }

    public function test_segment_vip_reports_member_count(): void
    {
        $this->withToken($this->ownerToken())->getJson('/api/v1/owner/segments')
            ->assertOk()
            ->assertJsonFragment(['name' => 'VIP', 'memberCount' => 1]);
    }

    public function test_segments_are_org_scoped_on_delete(): void
    {
        $tsr = Organization::where('slug', 'tsr-arena')->firstOrFail();
        $tsrSegment = CustomerSegment::create([
            'organization_id' => $tsr->id,
            'name' => 'TSR Segment',
        ]);

        // Everyday owner sees only its 3 segments, and cannot delete TSR's.
        $owner = $this->ownerToken();
        $this->withToken($owner)->getJson('/api/v1/owner/segments')
            ->assertOk()->assertJsonCount(3, 'data');

        $this->app['auth']->forgetGuards();
        $this->withToken($owner)->deleteJson("/api/v1/owner/segments/{$tsrSegment->id}")
            ->assertNotFound();

        $this->assertNotNull($tsrSegment->fresh());
    }

    public function test_broadcasts_list_create_and_send(): void
    {
        $owner = $this->ownerToken();

        // Seeded with 2 (1 sent, 1 draft).
        $this->withToken($owner)->getJson('/api/v1/owner/broadcasts')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonStructure(['data' => [[
                'id', 'title', 'message', 'channel', 'status',
                'recipientCount', 'sentAt', 'segmentName',
            ]]]);

        // Create a draft (no segment -> targets whole org).
        $this->app['auth']->forgetGuards();
        $created = $this->withToken($owner)->postJson('/api/v1/owner/broadcasts', [
            'title' => 'โปรวันนี้',
            'message' => 'ลดราคาวันนี้เท่านั้น',
            'channel' => 'line',
        ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.recipientCount', 0)
            ->assertJsonPath('data.segmentName', null);
        $id = $created->json('data.id');

        // Send -> status sent, recipient_count = org totalCustomers (1).
        $this->app['auth']->forgetGuards();
        $this->withToken($owner)->postJson("/api/v1/owner/broadcasts/{$id}/send")
            ->assertOk()
            ->assertJsonPath('data.status', 'sent')
            ->assertJsonPath('data.recipientCount', 1);

        $this->assertNotNull(Broadcast::find($id)->sent_at);
    }

    public function test_broadcast_send_uses_segment_member_count(): void
    {
        $owner = $this->ownerToken();
        $vip = CustomerSegment::where('name', 'VIP')->firstOrFail();

        $this->app['auth']->forgetGuards();
        $created = $this->withToken($owner)->postJson('/api/v1/owner/broadcasts', [
            'title' => 'VIP Only',
            'message' => 'ข้อเสนอพิเศษสำหรับ VIP',
            'channel' => 'push',
            'segmentId' => $vip->id,
        ])->assertCreated()
            ->assertJsonPath('data.segmentName', 'VIP');
        $id = $created->json('data.id');

        // VIP has 1 member.
        $this->app['auth']->forgetGuards();
        $this->withToken($owner)->postJson("/api/v1/owner/broadcasts/{$id}/send")
            ->assertOk()
            ->assertJsonPath('data.status', 'sent')
            ->assertJsonPath('data.recipientCount', 1);
    }

    public function test_timeline_returns_entries_newest_first(): void
    {
        $customerId = $this->demoCustomerId();

        $rows = $this->withToken($this->ownerToken())
            ->getJson("/api/v1/owner/timeline/{$customerId}")
            ->assertOk()
            ->assertJsonStructure(['data' => [['id', 'type', 'title', 'description', 'occurredAt']]])
            ->json('data');

        // Ordering, not a count: real events now write here too (observers), so
        // a fixed number would only be asserting how much demo data the seeder
        // happens to make.
        $times = array_column($rows, 'occurredAt');
        $sorted = $times;
        rsort($sorted);
        $this->assertSame($sorted, $times, 'newest first');

        // The seeded story is still in there, oldest last.
        $this->assertSame('signup', $rows[count($rows) - 1]['type']);
        $this->assertContains('points', array_column($rows, 'type'));
    }

    public function test_timeline_for_cross_org_customer_is_404(): void
    {
        $tsr = Organization::where('slug', 'tsr-arena')->firstOrFail();
        $tsrCustomer = Customer::create([
            'organization_id' => $tsr->id,
            'line_user_id' => 'Utsrcrm',
            'display_name' => 'TSR Cust',
        ]);

        $this->withToken($this->ownerToken())
            ->getJson("/api/v1/owner/timeline/{$tsrCustomer->id}")
            ->assertNotFound();
    }

    public function test_crm_requires_staff(): void
    {
        $customer = $this->customerToken();

        $this->withToken($customer)->getJson('/api/v1/owner/crm/overview')
            ->assertForbidden();

        $this->app['auth']->forgetGuards();
        $this->withToken($customer)->getJson('/api/v1/owner/segments')
            ->assertForbidden();

        $this->app['auth']->forgetGuards();
        $this->withToken($customer)->getJson('/api/v1/owner/broadcasts')
            ->assertForbidden();
    }
}
