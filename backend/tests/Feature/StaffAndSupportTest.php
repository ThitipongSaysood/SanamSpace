<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Role;
use App\Models\SupportTicket;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * The two things neither portal could do: manage staff after inviting them,
 * and answer a support ticket.
 *
 * The guards matter more than the happy paths — a venue that removes its last
 * owner, or a member who suspends themselves, locks the portal for good.
 */
class StaffAndSupportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    /** Laravel caches the resolved guard user between calls in one test. */
    private function as(string $token): static
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    private function ownerToken(): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test', 'password' => 'password',
        ])->json('token');
    }

    private function adminToken(): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'super@sanamspace.test', 'password' => 'password',
        ])->json('token');
    }

    private function everyday(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    private function roleId(string $code): string
    {
        return Role::where('code', $code)->firstOrFail()->id;
    }

    /** Invite someone and return their user id. */
    private function invite(string $token, string $email = 'staff1@everyday.test'): string
    {
        return $this->as($token)->postJson('/api/v1/owner/staff', [
            'email' => $email,
            'displayName' => 'พนักงานทดสอบ',
            'roleId' => $this->roleId('reception'),
        ])->assertCreated()->json('data.id');
    }

    // --- Staff: edit ----------------------------------------------------------

    public function test_owner_can_rename_a_staff_member(): void
    {
        $token = $this->ownerToken();
        $id = $this->invite($token);

        $this->as($token)->putJson("/api/v1/owner/staff/{$id}", ['displayName' => 'ชื่อใหม่'])
            ->assertOk()
            ->assertJsonPath('data.displayName', 'ชื่อใหม่');
    }

    public function test_owner_can_change_a_staff_role_and_suspend_them(): void
    {
        $token = $this->ownerToken();
        $id = $this->invite($token);

        $this->as($token)->putJson("/api/v1/owner/staff/{$id}", [
            'roleId' => $this->roleId('manager'),
            'status' => 'suspended',
        ])
            ->assertOk()
            ->assertJsonPath('data.roleName', Role::where('code', 'manager')->value('name'))
            ->assertJsonPath('data.status', 'suspended');
    }

    /** The lock-out guard: nobody may demote or suspend themselves. */
    public function test_a_member_cannot_change_their_own_role_or_status(): void
    {
        $token = $this->ownerToken();
        $me = $this->as($token)->getJson('/api/v1/auth/me')->json('data.id');

        $this->as($token)->putJson("/api/v1/owner/staff/{$me}", ['roleId' => $this->roleId('reception')])
            ->assertStatus(422);

        $this->as($token)->putJson("/api/v1/owner/staff/{$me}", ['status' => 'suspended'])
            ->assertStatus(422);
    }

    /** Renaming yourself is harmless, so it stays allowed. */
    public function test_a_member_can_still_rename_themselves(): void
    {
        $token = $this->ownerToken();
        $me = $this->as($token)->getJson('/api/v1/auth/me')->json('data.id');

        $this->as($token)->putJson("/api/v1/owner/staff/{$me}", ['displayName' => 'เจ้าของสนาม'])
            ->assertOk()
            ->assertJsonPath('data.displayName', 'เจ้าของสนาม');
    }

    // --- Staff: remove --------------------------------------------------------

    public function test_owner_can_remove_a_staff_member(): void
    {
        $token = $this->ownerToken();
        $id = $this->invite($token);

        $this->as($token)->deleteJson("/api/v1/owner/staff/{$id}")->assertOk();

        $this->assertDatabaseMissing('organization_users', [
            'organization_id' => $this->everyday()->id,
            'user_id' => $id,
        ]);
        // The person keeps their account — they may work at another venue.
        $this->assertDatabaseHas('users', ['id' => $id]);
    }

    public function test_a_member_cannot_remove_themselves(): void
    {
        $token = $this->ownerToken();
        $me = $this->as($token)->getJson('/api/v1/auth/me')->json('data.id');

        $this->as($token)->deleteJson("/api/v1/owner/staff/{$me}")->assertStatus(422);
    }

    /** Without an owner nobody can manage staff again. */
    public function test_the_last_owner_cannot_be_removed_or_demoted(): void
    {
        $org = $this->everyday();
        $token = $this->ownerToken();
        $other = $this->invite($token);

        // Promote the invitee to owner, then hand the seat over.
        $this->as($token)->putJson("/api/v1/owner/staff/{$other}", ['roleId' => $this->roleId('owner')])
            ->assertOk();

        $ownerMembership = OrganizationUser::where('organization_id', $org->id)
            ->whereHas('role', fn ($q) => $q->where('code', 'owner'))
            ->where('user_id', '!=', $other)
            ->firstOrFail();

        // Two owners: removing one is fine.
        $this->as($token)->deleteJson("/api/v1/owner/staff/{$other}")->assertOk();

        // One left: it may be neither removed nor demoted.
        $this->as($token)
            ->putJson("/api/v1/owner/staff/{$ownerMembership->user_id}", ['roleId' => $this->roleId('reception')])
            ->assertStatus(422);
    }

    public function test_a_venue_cannot_touch_another_venues_staff(): void
    {
        $tsr = Organization::where('slug', 'tsr-arena')->firstOrFail();
        $foreign = OrganizationUser::create([
            'organization_id' => $tsr->id,
            'user_id' => \App\Models\User::factory()->create()->id,
            'role_id' => $this->roleId('reception'),
            'display_name' => 'TSR Staff',
            'status' => 'active',
            'joined_at' => now(),
        ]);

        $token = $this->ownerToken();

        $this->as($token)->putJson("/api/v1/owner/staff/{$foreign->user_id}", ['displayName' => 'x'])
            ->assertNotFound();
        $this->as($token)->deleteJson("/api/v1/owner/staff/{$foreign->user_id}")->assertNotFound();
    }

    // --- Support --------------------------------------------------------------

    private function ticket(): SupportTicket
    {
        return SupportTicket::create([
            'ticket_no' => 'TK-TEST-0001',
            'organization_name' => 'Everyday Badminton',
            'subject' => 'เข้าระบบไม่ได้',
            'body' => 'ลองแล้วไม่ผ่าน',
            'status' => 'open',
            'priority' => 'high',
        ]);
    }

    public function test_admin_reply_is_recorded_and_emailed_to_the_venue(): void
    {
        Mail::fake();
        $ticket = $this->ticket();

        $this->as($this->adminToken())
            ->postJson("/api/v1/admin/support-tickets/{$ticket->id}/replies", [
                'body' => 'รบกวนลองรีเซ็ตรหัสผ่านอีกครั้งครับ',
            ])
            ->assertOk()
            ->assertJsonPath('data.replies.0.body', 'รบกวนลองรีเซ็ตรหัสผ่านอีกครั้งครับ')
            ->assertJsonPath('data.replies.0.authorSide', 'platform')
            // `emailed` is the real signal: Mail::fake() does not tally
            // Mail::raw sends, so counting mailables would prove nothing.
            ->assertJsonPath('data.replies.0.emailed', true)
            // Answering hands the ball back to the venue.
            ->assertJsonPath('data.status', 'pending');
    }

    /** No contact address is not a reason to lose the reply. */
    public function test_a_reply_is_kept_even_when_it_cannot_be_emailed(): void
    {
        Mail::fake();
        $ticket = $this->ticket();
        $ticket->update(['organization_name' => 'สนามที่ไม่มีในระบบ']);

        $this->as($this->adminToken())
            ->postJson("/api/v1/admin/support-tickets/{$ticket->id}/replies", ['body' => 'ตอบกลับ'])
            ->assertOk()
            ->assertJsonPath('data.replies.0.emailed', false);
    }

    public function test_reply_requires_a_body(): void
    {
        $ticket = $this->ticket();

        $this->as($this->adminToken())
            ->postJson("/api/v1/admin/support-tickets/{$ticket->id}/replies", ['body' => ''])
            ->assertStatus(422);
    }

    public function test_admin_can_resolve_and_reopen_a_ticket(): void
    {
        $ticket = $this->ticket();
        $admin = $this->adminToken();

        $this->as($admin)->putJson("/api/v1/admin/support-tickets/{$ticket->id}/status", [
            'status' => 'resolved',
        ])->assertOk()->assertJsonPath('data.status', 'resolved');

        $resolvedAt = $ticket->fresh()->resolved_at;
        $this->assertNotNull($resolvedAt);

        $this->as($admin)->putJson("/api/v1/admin/support-tickets/{$ticket->id}/status", [
            'status' => 'open',
        ])->assertOk();
        $this->assertNull($ticket->fresh()->resolved_at);

        // Re-resolving stamps a fresh time rather than resurrecting the old one.
        $this->as($admin)->putJson("/api/v1/admin/support-tickets/{$ticket->id}/status", [
            'status' => 'closed',
        ])->assertOk();
        $this->assertNotNull($ticket->fresh()->resolved_at);
    }

    public function test_open_tickets_are_listed_before_settled_ones(): void
    {
        $settled = $this->ticket();
        $settled->update(['status' => 'closed', 'ticket_no' => 'TK-TEST-CLOSED']);
        SupportTicket::create([
            'ticket_no' => 'TK-TEST-OPEN',
            'organization_name' => 'Everyday Badminton',
            'subject' => 'ยังไม่ได้ตอบ',
            'status' => 'open',
            'priority' => 'low',
        ]);

        $first = $this->as($this->adminToken())->getJson('/api/v1/admin/support-tickets')
            ->assertOk()
            ->json('data.0.ticketNo');

        $this->assertSame('TK-TEST-OPEN', $first);
    }

    public function test_support_actions_require_a_super_admin(): void
    {
        $ticket = $this->ticket();

        $this->as($this->ownerToken())
            ->postJson("/api/v1/admin/support-tickets/{$ticket->id}/replies", ['body' => 'x'])
            ->assertForbidden();
    }
}
