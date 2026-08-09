<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\SupportTicket;
use Database\Seeders\PlatformAdminSeeder;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * A venue asking the platform for help.
 *
 * The desk could read tickets, answer them and close them — and nothing in the
 * codebase could create one. Every row in the inbox came from the seeder, and
 * the "ติดต่อฝ่ายสนับสนุน" link went to the settings page.
 */
class OwnerSupportTicketTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;

    private string $owner;

    private string $super;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
        $this->seed(PlatformAdminSeeder::class);
        $this->org = Organization::where('slug', 'everyday-badminton')->firstOrFail();
        Mail::fake();

        // Both tokens up front, before any authenticated request. Logging in as
        // the second actor mid-test re-caches the first one's identity on the
        // guard — the hazard AuthController::adminLogin documents.
        $this->owner = $this->login('owner@everyday.test');
        $this->super = $this->login('super@sanamspace.test');
    }

    private function login(string $email): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => $email,
            'password' => 'password',
        ])->json('token');
    }

    /**
     * Act as the holder of $token.
     *
     * forgetGuards because Laravel keeps the resolved user between HTTP calls
     * inside one test: a bare second withToken() stays authenticated as the
     * first actor, which turns every admin call in this file into an owner call
     * and answers 403 — see SubscriptionRenewalTest, which hit the same wall.
     */
    private function asOwner(string $token): TestResponse|self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token)->withHeader('X-Venue-Slug', $this->org->slug);
    }

    private function asAdmin(string $token): TestResponse|self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    public function test_a_venue_can_open_a_ticket_and_it_reaches_the_platform_desk(): void
    {
        $token = $this->owner;

        $this->asOwner($token)->postJson('/api/v1/owner/support-tickets', [
            'subject' => 'สแกน QR แล้วขึ้นว่าไม่พบการจอง',
            'body' => 'ตั้งแต่เช้านี้ พนักงานสแกนแล้วขึ้นแบบนี้ทุกครั้ง',
        ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'open')
            // The opening message is the first entry in the thread, so the
            // conversation does not start mid-sentence.
            ->assertJsonPath('data.replies.0.authorSide', 'organization');

        // Somewhere in the queue, not necessarily first: the desk sorts by who
        // owes the next move, and seeded tickets are older but still open.
        $subjects = collect($this->asAdmin($this->super)
            ->getJson('/api/v1/admin/support-tickets')
            ->assertOk()
            ->json('data'))->pluck('subject');

        $this->assertContains('สแกน QR แล้วขึ้นว่าไม่พบการจอง', $subjects);
    }

    public function test_a_venue_sees_only_its_own_tickets(): void
    {
        $other = Organization::where('slug', '!=', $this->org->slug)->firstOrFail();
        SupportTicket::create([
            'ticket_no' => 'TCK-OTHER-1',
            'organization_id' => $other->id,
            'organization_name' => $other->name,
            'subject' => 'ของสนามอื่น',
            'status' => 'open',
            'priority' => 'medium',
        ]);

        $token = $this->owner;
        $this->asOwner($token)->postJson('/api/v1/owner/support-tickets', [
            'subject' => 'ของเราเอง',
            'body' => 'รายละเอียด',
        ])->assertCreated();

        $rows = $this->asOwner($token)->getJson('/api/v1/owner/support-tickets')->assertOk()->json('data');

        $this->assertCount(1, $rows);
        $this->assertSame('ของเราเอง', $rows[0]['subject']);
    }

    /** The venue is not told which of us picked it up. */
    public function test_the_venue_is_not_shown_the_desk_s_internal_notes(): void
    {
        $token = $this->owner;
        $ticket = $this->asOwner($token)->postJson('/api/v1/owner/support-tickets', [
            'subject' => 'เรื่องหนึ่ง',
            'body' => 'รายละเอียด',
        ])->json('data');

        $this->asAdmin($this->super)
            ->putJson("/api/v1/admin/support-tickets/{$ticket['id']}/status", [
                'status' => 'pending',
                'assignedTo' => 'พนักงานฝ่ายซัพพอร์ต',
            ])->assertOk();

        $rows = $this->asOwner($token)->getJson('/api/v1/owner/support-tickets')->json('data');
        $this->assertArrayNotHasKey('assignedTo', $rows[0]);
    }

    public function test_a_reply_from_the_venue_reopens_a_settled_ticket(): void
    {
        $token = $this->owner;
        $ticket = $this->asOwner($token)->postJson('/api/v1/owner/support-tickets', [
            'subject' => 'ยังไม่จบ',
            'body' => 'รายละเอียด',
        ])->json('data');

        $this->asAdmin($this->super)
            ->putJson("/api/v1/admin/support-tickets/{$ticket['id']}/status", ['status' => 'resolved'])
            ->assertOk();

        // If they are still talking, it is not resolved — and the platform's
        // queue has to show that rather than hiding it under "done".
        $this->asOwner($token)
            ->postJson("/api/v1/owner/support-tickets/{$ticket['id']}/replies", ['body' => 'ยังเป็นอยู่เลยครับ'])
            ->assertOk()
            ->assertJsonPath('data.status', 'open')
            ->assertJsonPath('data.resolvedAt', null);
    }

    public function test_a_venue_cannot_reply_to_another_venues_ticket(): void
    {
        $other = Organization::where('slug', '!=', $this->org->slug)->firstOrFail();
        $ticket = SupportTicket::create([
            'ticket_no' => 'TCK-OTHER-2',
            'organization_id' => $other->id,
            'organization_name' => $other->name,
            'subject' => 'ของสนามอื่น',
            'status' => 'open',
            'priority' => 'medium',
        ]);

        $this->asOwner($this->owner)
            ->postJson("/api/v1/owner/support-tickets/{$ticket->id}/replies", ['body' => 'แอบตอบ'])
            ->assertNotFound();
    }

    /**
     * The platform's answer has to be readable by the venue that asked. It is
     * also emailed, but an answer that only exists in an inbox nobody watches
     * is not an answer.
     */
    public function test_the_platforms_reply_appears_in_the_venues_thread(): void
    {
        $token = $this->owner;
        $ticket = $this->asOwner($token)->postJson('/api/v1/owner/support-tickets', [
            'subject' => 'คำถาม',
            'body' => 'รายละเอียด',
        ])->json('data');

        $this->asAdmin($this->super)
            ->postJson("/api/v1/admin/support-tickets/{$ticket['id']}/replies", ['body' => 'แก้ให้แล้วครับ'])
            ->assertOk();

        $rows = $this->asOwner($token)->getJson('/api/v1/owner/support-tickets')->json('data');
        $replies = $rows[0]['replies'];

        $this->assertSame('platform', end($replies)['authorSide']);
        $this->assertSame('แก้ให้แล้วครับ', end($replies)['body']);
    }
}
