<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Court;
use App\Models\Organization;
use App\Models\Sport;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The sport catalogue: one list, owned by the platform.
 *
 * The bug this replaces was quiet. `branches.sports` was a text box validated
 * as `string|max:50`, and it is what decides the customer app's loading screen
 * and its notification icon. A key the frontend did not recognise was dropped
 * without a word and the venue fell back to badminton — so a tennis venue
 * showed its customers a shuttlecock and nothing said why. Meanwhile the court
 * form offered four sports, the loader knew ten and the toast knew twelve, all
 * hard-coded separately.
 *
 * So the assertions below are mostly about the two halves agreeing: what the
 * platform offers is what a venue can store, and what a venue stores is what
 * its customers see.
 */
class SportCatalogueTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function adminToken(): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'super@sanamspace.test',
            'password' => 'password',
        ])->json('token');
    }

    private function ownerToken(): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');
    }

    /** Laravel caches the resolved guard user between calls inside one test. */
    private function as(string $token): self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    // ---- the catalogue exists and is seeded from what the code already knew --

    public function test_the_migration_seeds_every_sport_the_old_code_could_draw(): void
    {
        $keys = Sport::query()->pluck('key');

        // The loader knew ten and the toast twelve; the court form offered
        // four. All of them are here now, once each.
        foreach (['badminton', 'futsal', 'football', 'tennis', 'pickleball', 'squash', 'basketball', 'volleyball', 'takraw', 'tabletennis'] as $key) {
            $this->assertContains($key, $keys->all());
        }

        // `soccer` and `pingpong` were second names for a sport already in the
        // list. Two "ฟุตบอล" in a picker is a question nobody can answer.
        $this->assertNotContains('soccer', $keys->all());
        $this->assertNotContains('pingpong', $keys->all());
    }

    // ---- a venue can only store what the platform offers ---------------------

    public function test_a_branch_cannot_name_a_sport_the_platform_does_not_have(): void
    {
        $branch = Branch::query()->where('organization_id', $this->org()->id)->firstOrFail();

        $this->as($this->ownerToken())
            ->putJson("/api/v1/owner/branches/{$branch->id}", ['sports' => ['badminton', 'quidditch']])
            ->assertStatus(422)
            ->assertJsonValidationErrors('sports.1');

        // …and the rejected write changed nothing.
        $this->assertSame(['badminton'], (array) $branch->fresh()->sports);
    }

    public function test_a_court_cannot_name_a_sport_the_platform_does_not_have(): void
    {
        $branch = Branch::query()->where('organization_id', $this->org()->id)->firstOrFail();

        $this->as($this->ownerToken())
            ->postJson('/api/v1/owner/courts', [
                'branchId' => $branch->id,
                'name' => 'คอร์ทผี',
                'sport' => 'quidditch',
                'pricePerHour' => 250,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('sport');
    }

    public function test_a_sport_added_by_the_platform_is_offered_to_venues_at_once(): void
    {
        $this->as($this->adminToken())
            ->postJson('/api/v1/admin/sports', [
                'key' => 'sepak',
                'name' => 'เซปักตะกร้อชายหาด',
                'emoji' => '🏐',
                'color' => '#0ea5e9',
            ])
            ->assertCreated()
            ->assertJsonPath('data.key', 'sepak');

        // No deploy in between: the owner's picker and the validator both read
        // the table, which is the whole point of moving the list into one.
        $offered = collect($this->as($this->ownerToken())->getJson('/api/v1/owner/sports')->json('data'))->pluck('key');
        $this->assertContains('sepak', $offered->all());

        $branch = Branch::query()->where('organization_id', $this->org()->id)->firstOrFail();
        $this->as($this->ownerToken())
            ->putJson("/api/v1/owner/branches/{$branch->id}", ['sports' => ['sepak']])
            ->assertOk();
    }

    // ---- switching one off, without breaking the venues on it ---------------

    public function test_deactivating_a_sport_hides_it_from_the_picker_but_leaves_venues_alone(): void
    {
        $tennis = Sport::where('key', 'tennis')->firstOrFail();

        $this->as($this->adminToken())
            ->putJson("/api/v1/admin/sports/{$tennis->id}", ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('data.isActive', false);

        $offered = collect($this->as($this->ownerToken())->getJson('/api/v1/owner/sports')->json('data'))->pluck('key');
        $this->assertNotContains('tennis', $offered->all());

        // Still a valid value: a venue already renting it must not have its
        // branch turned un-saveable by a decision made elsewhere.
        $branch = Branch::query()->where('organization_id', $this->org()->id)->firstOrFail();
        $this->as($this->ownerToken())
            ->putJson("/api/v1/owner/branches/{$branch->id}", ['sports' => ['tennis']])
            ->assertOk();
    }

    public function test_a_sport_in_use_cannot_be_deleted(): void
    {
        $badminton = Sport::where('key', 'badminton')->firstOrFail();

        $this->as($this->adminToken())
            ->deleteJson("/api/v1/admin/sports/{$badminton->id}")
            ->assertStatus(422)
            ->assertJsonValidationErrors('key');

        $this->assertNotNull($badminton->fresh());
    }

    public function test_an_unused_sport_can_be_deleted(): void
    {
        $squash = Sport::where('key', 'squash')->firstOrFail();

        $this->as($this->adminToken())
            ->deleteJson("/api/v1/admin/sports/{$squash->id}")
            ->assertOk();

        $this->assertNull($squash->fresh());
    }

    public function test_the_list_reports_how_many_venues_each_sport_holds_up(): void
    {
        $rows = collect($this->as($this->adminToken())->getJson('/api/v1/admin/sports')->json('data'))->keyBy('key');

        $this->assertGreaterThan(0, $rows['badminton']['venueCount'], 'the seeded venues rent badminton');
        $this->assertSame(0, $rows['squash']['venueCount']);
    }

    // ---- what the customer app is handed ------------------------------------

    public function test_the_venue_payload_carries_the_look_of_each_sport(): void
    {
        $meta = $this->getJson('/api/v1/orgs/everyday-badminton/public')->assertOk()->json('sportMeta');

        $this->assertSame([['key' => 'badminton', 'name' => 'แบดมินตัน', 'emoji' => '🏸', 'color' => '#ef4444']], $meta);
    }

    /**
     * A key with no catalogue row gets a neutral entry, not a shuttlecock.
     *
     * This is the original bug stated as a test: the venue rents something the
     * platform has never heard of, and the honest answer is a plain icon and
     * the venue's own word — not badminton, which is a confident wrong answer.
     */
    public function test_an_unrecognised_sport_is_shown_plainly_rather_than_guessed(): void
    {
        Branch::query()->where('organization_id', $this->org()->id)->update(['sports' => json_encode(['quidditch'])]);

        $meta = $this->getJson('/api/v1/orgs/everyday-badminton/public')->assertOk()->json('sportMeta');

        $this->assertSame('quidditch', $meta[0]['key']);
        $this->assertNotSame('🏸', $meta[0]['emoji']);
    }

    public function test_a_multi_sport_venue_gets_every_one_of_its_sports(): void
    {
        $keys = collect($this->getJson('/api/v1/orgs/tsr-arena/public')->assertOk()->json('sportMeta'))->pluck('key');

        // TSR runs three branches on the Business tier, and the payload is the
        // union across them — asserted against the fixture so growing the demo
        // venue does not read as a regression.
        $expected = \App\Models\Branch::query()
            ->where('organization_id', Organization::where('slug', 'tsr-arena')->value('id'))
            ->get()
            ->flatMap(fn ($b) => (array) $b->sports)
            ->unique()
            ->values()
            ->all();

        $this->assertEqualsCanonicalizing($expected, $keys->all());
        $this->assertContains('futsal', $keys->all());
    }

    // ---- the platform side of a venue's own sports --------------------------

    /**
     * An admin setting a customer up can pick that venue's sports.
     *
     * Per branch, because that is where the value lives. The assertion that
     * matters is the last one: it went all the way through to what the venue's
     * customers are actually shown.
     */
    public function test_an_admin_can_set_a_branch_sports_and_the_app_follows(): void
    {
        $branch = Branch::query()->where('organization_id', $this->org()->id)->firstOrFail();

        $this->as($this->adminToken())
            ->putJson("/api/v1/admin/organizations/everyday-badminton/branches/{$branch->id}/sports", [
                'sports' => ['tennis', 'pickleball'],
            ])
            ->assertOk()
            ->assertJsonPath('data.branches.0.sports', ['tennis', 'pickleball']);

        $meta = $this->getJson('/api/v1/orgs/everyday-badminton/public')->json('sportMeta');

        $this->assertSame('tennis', $meta[0]['key']);
        $this->assertSame('🎾', $meta[0]['emoji']);
    }

    public function test_the_platform_side_refuses_a_sport_it_does_not_have_either(): void
    {
        $branch = Branch::query()->where('organization_id', $this->org()->id)->firstOrFail();

        $this->as($this->adminToken())
            ->putJson("/api/v1/admin/organizations/everyday-badminton/branches/{$branch->id}/sports", [
                'sports' => ['quidditch'],
            ])
            ->assertStatus(422);

        $this->assertSame(['badminton'], (array) $branch->fresh()->sports);
    }

    /** A branch id from another venue is not reachable through this venue. */
    public function test_it_cannot_reach_a_branch_of_another_venue(): void
    {
        $other = Organization::where('slug', '!=', 'everyday-badminton')->firstOrFail();
        $branch = Branch::query()->where('organization_id', $other->id)->firstOrFail();
        $before = (array) $branch->sports;

        $this->as($this->adminToken())
            ->putJson("/api/v1/admin/organizations/everyday-badminton/branches/{$branch->id}/sports", [
                'sports' => ['tennis'],
            ])
            ->assertNotFound();

        $this->assertSame($before, (array) $branch->fresh()->sports);
    }

    /**
     * Changing what someone else's customers see leaves a trace.
     *
     * The audit log is the only record that a platform admin — rather than the
     * venue — decided this.
     */
    public function test_the_change_is_written_to_the_audit_log(): void
    {
        $branch = Branch::query()->where('organization_id', $this->org()->id)->firstOrFail();

        $this->as($this->adminToken())
            ->putJson("/api/v1/admin/organizations/everyday-badminton/branches/{$branch->id}/sports", [
                'sports' => ['tennis'],
            ])
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'organization_id' => $this->org()->id,
            'action' => 'แก้ประเภทกีฬาของสนาม',
        ]);
    }

    // ---- who may touch the catalogue ----------------------------------------

    public function test_a_venue_owner_cannot_edit_the_platform_catalogue(): void
    {
        $tennis = Sport::where('key', 'tennis')->firstOrFail();

        $this->as($this->ownerToken())
            ->putJson("/api/v1/admin/sports/{$tennis->id}", ['name' => 'ของผม'])
            ->assertForbidden();

        $this->assertSame('เทนนิส', $tennis->fresh()->name);
    }

    public function test_the_key_is_a_lookup_not_a_label(): void
    {
        $this->as($this->adminToken())
            ->postJson('/api/v1/admin/sports', [
                'key' => 'ตะกร้อลอดห่วง',
                'name' => 'ตะกร้อลอดห่วง',
                'emoji' => '🏐',
                'color' => '#0ea5e9',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('key');
    }

    public function test_two_sports_cannot_share_a_key(): void
    {
        $this->as($this->adminToken())
            ->postJson('/api/v1/admin/sports', [
                'key' => 'tennis',
                'name' => 'เทนนิสอีกอัน',
                'emoji' => '🎾',
                'color' => '#0ea5e9',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('key');
    }

    public function test_a_court_keeps_working_on_a_catalogue_key(): void
    {
        $branch = Branch::query()->where('organization_id', $this->org()->id)->firstOrFail();

        $id = $this->as($this->ownerToken())
            ->postJson('/api/v1/owner/courts', [
                'branchId' => $branch->id,
                'name' => 'คอร์ทพิคเคิลบอล',
                'sport' => 'pickleball',
                'pricePerHour' => 300,
            ])
            ->assertCreated()
            ->json('data.id');

        $this->assertSame('pickleball', Court::findOrFail($id)->sport);
    }
}
