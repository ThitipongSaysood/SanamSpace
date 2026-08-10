<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Organization;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * CRM WP6 — staff notes and follow-up tasks on a customer, surfaced on the
 * customer detail. Writes are crm.manage; a note also lands on the timeline.
 */
class CustomerNotesTasksTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
        $this->org = Organization::where('slug', 'everyday-badminton')->firstOrFail();
        $this->customer = Customer::where('organization_id', $this->org->id)->firstOrFail();
    }

    private function ownerToken(): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');
    }

    private function as(string $token): \Illuminate\Testing\TestResponse|self
    {
        return $this->withToken($token)->withHeader('X-Venue-Slug', $this->org->slug);
    }

    public function test_a_note_is_added_shown_on_detail_and_written_to_the_timeline(): void
    {
        $token = $this->ownerToken();

        $noteId = $this->as($token)->postJson("/api/v1/owner/customers/{$this->customer->id}/notes", [
            'body' => 'ชอบเล่นเย็น ๆ ขอคอร์ท 3',
        ])->assertCreated()->json('data.id');

        // On the detail.
        $this->app['auth']->forgetGuards();
        $this->as($this->ownerToken())->getJson("/api/v1/owner/customers/{$this->customer->id}")
            ->assertOk()
            ->assertJsonPath('data.notes.0.body', 'ชอบเล่นเย็น ๆ ขอคอร์ท 3');

        // And on the timeline (the previously-unused `note` type).
        $this->assertDatabaseHas('customer_timeline', [
            'customer_id' => $this->customer->id,
            'type' => 'note',
        ]);

        // Delete it.
        $this->app['auth']->forgetGuards();
        $this->as($this->ownerToken())->deleteJson("/api/v1/owner/customers/{$this->customer->id}/notes/{$noteId}")
            ->assertOk()->assertJsonPath('deleted', true);
        $this->assertDatabaseMissing('customer_notes', ['id' => $noteId]);
    }

    public function test_a_task_can_be_created_toggled_and_deleted(): void
    {
        $token = $this->ownerToken();

        $taskId = $this->as($token)->postJson("/api/v1/owner/customers/{$this->customer->id}/tasks", [
            'title' => 'โทรตามลูกค้าที่หายไป',
            'dueAt' => '2026-09-01',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'open')
            ->assertJsonPath('data.dueAt', '2026-09-01')
            ->json('data.id');

        // Toggle → done.
        $this->app['auth']->forgetGuards();
        $this->as($this->ownerToken())->postJson("/api/v1/owner/customers/{$this->customer->id}/tasks/{$taskId}/toggle")
            ->assertOk()->assertJsonPath('data.status', 'done');
        $this->assertDatabaseHas('customer_tasks', ['id' => $taskId, 'status' => 'done']);

        // Toggle → open again.
        $this->app['auth']->forgetGuards();
        $this->as($this->ownerToken())->postJson("/api/v1/owner/customers/{$this->customer->id}/tasks/{$taskId}/toggle")
            ->assertOk()->assertJsonPath('data.status', 'open');

        // Delete.
        $this->app['auth']->forgetGuards();
        $this->as($this->ownerToken())->deleteJson("/api/v1/owner/customers/{$this->customer->id}/tasks/{$taskId}")
            ->assertOk();
        $this->assertDatabaseMissing('customer_tasks', ['id' => $taskId]);
    }

    public function test_notes_are_org_scoped(): void
    {
        // A customer belonging to the OTHER seeded venue.
        $otherOrg = Organization::where('slug', '!=', 'everyday-badminton')->firstOrFail();
        $otherCustomer = Customer::create([
            'organization_id' => $otherOrg->id,
            'display_name' => 'Someone Else\'s Customer',
        ]);

        $this->as($this->ownerToken())
            ->postJson("/api/v1/owner/customers/{$otherCustomer->id}/notes", ['body' => 'x'])
            ->assertNotFound();
    }
}
