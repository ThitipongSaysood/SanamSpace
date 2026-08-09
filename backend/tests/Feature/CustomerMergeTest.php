<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\OrganizationSetting;
use App\Models\OrganizationUser;
use App\Models\Role;
use App\Models\User;
use App\Models\Wallet;
use App\Services\CustomerMergeService;
use App\Support\ThaiPhone;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * One person, one record.
 *
 * Duplicates are made at the counter — the same regular booked as a walk-in
 * every visit — and each row holds part of what the customer is owed. These
 * cover both halves of the answer: stop making new ones, and fold the existing
 * ones back together without losing anything on the way.
 */
class CustomerMergeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
        OrganizationSetting::query()->updateOrCreate(
            ['organization_id' => $this->org()->id],
            ['points_enabled' => true, 'tier_thresholds' => ['Silver' => 0, 'Gold' => 100, 'Platinum' => 1000]],
        );
    }

    // ---- one shape for a phone number --------------------------------------

    /** The three spellings staff, the app and LINE each produce. */
    public function test_the_same_number_written_three_ways_normalises_to_one(): void
    {
        $this->assertSame('0812345678', ThaiPhone::normalize('081-234-5678'));
        $this->assertSame('0812345678', ThaiPhone::normalize('0812345678'));
        $this->assertSame('0812345678', ThaiPhone::normalize('+66 81 234 5678'));
        $this->assertSame('0812345678', ThaiPhone::normalize(' 081 234 5678 '));
    }

    /** Too short to identify anyone, so it must not become a matching key. */
    public function test_a_fragment_is_not_a_phone_number(): void
    {
        $this->assertNull(ThaiPhone::normalize('1234'));
        $this->assertNull(ThaiPhone::normalize(''));
        $this->assertNull(ThaiPhone::normalize(null));
    }

    public function test_saving_a_customer_keeps_the_comparable_copy_in_step(): void
    {
        $c = Customer::create([
            'organization_id' => $this->org()->id,
            'display_name' => 'คุณเบอร์',
            'phone' => '081-999-8888',
        ]);

        $this->assertSame('0819998888', $c->fresh()->phone_normalized);

        $c->update(['phone' => '+66 82 111 2222']);
        $this->assertSame('0821112222', $c->fresh()->phone_normalized);
    }

    // ---- not making new ones -----------------------------------------------

    /**
     * The bug this whole thing exists for: booking the same walk-in twice used
     * to make two customers, splitting their points between rows.
     */
    public function test_booking_the_same_walk_in_twice_does_not_make_two_customers(): void
    {
        $before = Customer::query()->forOrganization($this->org()->id)->count();
        $token = $this->login('owner@everyday.test');

        $this->as($token)->postJson('/api/v1/owner/bookings', $this->bookingBody([
            'customerName' => 'คุณประจำ',
            'customerPhone' => '081-555-4444',
            'start' => '08:00', 'end' => '09:00',
        ]))->assertCreated();

        // Same person, next week, typed the way the second staff member types it.
        $this->as($token)->postJson('/api/v1/owner/bookings', $this->bookingBody([
            'customerName' => 'ประจำ',
            'customerPhone' => '0815554444',
            'start' => '09:00', 'end' => '10:00',
        ]))->assertCreated();

        $this->assertSame(
            $before + 1,
            Customer::query()->forOrganization($this->org()->id)->count(),
            'the second booking found the customer who was already here',
        );

        $customer = Customer::query()->forOrganization($this->org()->id)->where('phone_normalized', '0815554444')->firstOrFail();
        $this->assertSame(2, $customer->bookings()->count(), 'both visits belong to one person');
    }

    /** Two people can share a name. Only the phone says they are one person. */
    public function test_two_walk_ins_with_the_same_name_stay_two_customers(): void
    {
        $token = $this->login('owner@everyday.test');

        $this->as($token)->postJson('/api/v1/owner/bookings', $this->bookingBody([
            'customerName' => 'สมชาย', 'customerPhone' => '081-111-1111',
            'start' => '10:00', 'end' => '11:00',
        ]))->assertCreated();

        $this->as($token)->postJson('/api/v1/owner/bookings', $this->bookingBody([
            'customerName' => 'สมชาย', 'customerPhone' => '082-222-2222',
            'start' => '11:00', 'end' => '12:00',
        ]))->assertCreated();

        $this->assertSame(2, Customer::query()->forOrganization($this->org()->id)->where('display_name', 'สมชาย')->count());
    }

    /** No phone is still allowed — it just cannot be matched to anyone. */
    public function test_a_walk_in_without_a_phone_still_books(): void
    {
        $this->as($this->login('owner@everyday.test'))
            ->postJson('/api/v1/owner/bookings', $this->bookingBody([
                'customerName' => 'ไม่บอกเบอร์', 'start' => '12:00', 'end' => '13:00',
            ]))
            ->assertCreated();

        $this->assertNotNull(
            Customer::query()->forOrganization($this->org()->id)->where('display_name', 'ไม่บอกเบอร์')->first(),
        );
    }

    // ---- folding the existing ones together --------------------------------

    public function test_merging_moves_the_bookings_points_and_credit(): void
    {
        [$keep, $dupe] = $this->twoOfTheSamePerson();

        $this->as($this->login('owner@everyday.test'))
            ->postJson("/api/v1/owner/customers/{$keep->id}/merge", ['duplicateId' => $dupe->id])
            ->assertOk();

        $this->assertSame(2, $keep->bookings()->count(), 'both bookings are on one customer now');
        $this->assertSame(130, (int) Membership::where('customer_id', $keep->id)->value('points'), '30 + 100');
        $this->assertSame(250.0, (float) Wallet::where('customer_id', $keep->id)->value('balance'), '฿100 + ฿150');
        $this->assertSoftDeleted('customers', ['id' => $dupe->id]);
    }

    /** Nothing may be left pointing at the row that is now gone. */
    public function test_nothing_is_left_behind_on_the_duplicate(): void
    {
        [$keep, $dupe] = $this->twoOfTheSamePerson();

        app(CustomerMergeService::class)->merge($keep, $dupe);

        foreach (CustomerMergeService::SIMPLE_TABLES as $table) {
            $rows = DB::table($table)->where('customer_id', $dupe->id)->get();
            $this->assertCount(
                0,
                $rows,
                "{$table} still points at the merged-away customer: ".json_encode($rows, JSON_UNESCAPED_UNICODE),
            );
        }
    }

    /**
     * Moving points is not losing them.
     *
     * Emptying the duplicate through the model wrote "แต้มสะสม -100" into the
     * history — a record of points being taken away from someone who lost
     * nothing. The customer's own history must only show the gain.
     */
    public function test_the_merge_does_not_record_points_being_taken_away(): void
    {
        [$keep, $dupe] = $this->twoOfTheSamePerson();

        app(CustomerMergeService::class)->merge($keep, $dupe);

        $entries = DB::table('customer_timeline')
            ->whereIn('customer_id', [$keep->id, $dupe->id])
            ->where('type', 'points')
            ->pluck('title');

        foreach ($entries as $title) {
            $this->assertStringNotContainsString('-', $title, "history reads as a loss: {$title}");
        }

        $this->assertTrue(
            $entries->contains(fn ($t) => str_contains($t, '+100')),
            'the gain from the merge is worth recording',
        );
    }

    /**
     * The list is hand-written, so this walks the schema and fails when a new
     * table gains a customer_id without being added — the alternative is
     * finding out when a customer's history disappears.
     */
    public function test_every_table_holding_a_customer_id_is_covered(): void
    {
        $handled = array_merge(CustomerMergeService::SIMPLE_TABLES, [
            'customers',                 // the rows being merged
            'customer_segment_members',  // deduped, then moved
            'memberships',               // points added together
            'wallets',                   // balance added together
        ]);

        $missing = [];

        foreach ($this->tablesWithCustomerId() as $table) {
            if (! in_array($table, $handled, true)) {
                $missing[] = $table;
            }
        }

        $this->assertSame([], $missing, 'these tables would be stranded by a merge: '.implode(', ', $missing));
    }

    /** Two Silvers do not add up to a Gold nobody earned. */
    public function test_the_tier_is_recomputed_from_the_combined_lifetime(): void
    {
        [$keep, $dupe] = $this->twoOfTheSamePerson();

        // 30 + 100 lifetime crosses the Gold threshold of 100 for the first time.
        $this->assertSame('Silver', Membership::where('customer_id', $keep->id)->value('tier'));

        app(CustomerMergeService::class)->merge($keep, $dupe);

        $this->assertSame('Gold', Membership::where('customer_id', $keep->id)->value('tier'));
    }

    /** Their choice not to be contacted survives being merged. */
    public function test_an_unsubscribe_on_either_row_wins(): void
    {
        [$keep, $dupe] = $this->twoOfTheSamePerson();
        $keep->update(['marketing_consent' => true]);
        $dupe->update(['marketing_consent' => false, 'unsubscribed_at' => now()]);

        app(CustomerMergeService::class)->merge($keep, $dupe);

        $this->assertFalse((bool) $keep->fresh()->marketing_consent);
    }

    /** The survivor picks up what it was missing, and keeps what it had. */
    public function test_the_survivor_gains_the_missing_details_only(): void
    {
        [$keep, $dupe] = $this->twoOfTheSamePerson();
        $keep->update(['email' => null]);
        $dupe->update(['email' => 'somchai@example.com', 'display_name' => 'ชื่อจากใบซ้ำ']);

        app(CustomerMergeService::class)->merge($keep, $dupe);

        $this->assertSame('somchai@example.com', $keep->fresh()->email);
        $this->assertSame('คุณประจำ', $keep->fresh()->display_name, 'a name that was already there is not replaced');
    }

    /** Two venues' customers are two customers, whoever they are. */
    public function test_it_refuses_to_merge_across_venues(): void
    {
        $other = Organization::where('slug', '!=', 'everyday-badminton')->firstOrFail();
        $keep = $this->customer('คุณของเรา', '081-000-0000');
        $theirs = Customer::create([
            'organization_id' => $other->id,
            'display_name' => 'คุณของสนามอื่น',
            'phone' => '081-000-0000',
        ]);

        $this->as($this->login('owner@everyday.test'))
            ->postJson("/api/v1/owner/customers/{$keep->id}/merge", ['duplicateId' => $theirs->id])
            ->assertStatus(422);

        $this->assertNotSoftDeleted('customers', ['id' => $theirs->id]);
    }

    /** Moving points and credit is not something "view customers" may do. */
    public function test_a_view_only_role_cannot_merge(): void
    {
        [$keep, $dupe] = $this->twoOfTheSamePerson();
        $staff = $this->staff('viewer');

        $this->as($this->login($staff->email))
            ->postJson("/api/v1/owner/customers/{$keep->id}/merge", ['duplicateId' => $dupe->id])
            ->assertForbidden();

        $this->assertNotSoftDeleted('customers', ['id' => $dupe->id]);
    }

    // ---- finding them ------------------------------------------------------

    public function test_the_duplicates_list_groups_them_by_phone(): void
    {
        [$keep, $dupe] = $this->twoOfTheSamePerson();

        $groups = $this->as($this->login('owner@everyday.test'))
            ->getJson('/api/v1/owner/customers/duplicates')
            ->assertOk()
            ->json('data');

        $group = collect($groups)->firstWhere('phone', '0812223333');

        $this->assertNotNull($group, 'the pair sharing a number is a group');
        $ids = collect($group['customers'])->pluck('id')->all();
        $this->assertContains((string) $keep->id, $ids);
        $this->assertContains((string) $dupe->id, $ids);
        // What would move, shown before deciding which row to keep.
        $this->assertSame(100, collect($group['customers'])->firstWhere('id', (string) $dupe->id)['points']);
    }

    /** A merged pair is no longer a pair. */
    public function test_a_merged_pair_leaves_the_duplicates_list(): void
    {
        [$keep, $dupe] = $this->twoOfTheSamePerson();
        app(CustomerMergeService::class)->merge($keep, $dupe);

        $groups = $this->as($this->login('owner@everyday.test'))
            ->getJson('/api/v1/owner/customers/duplicates')
            ->assertOk()
            ->json('data');

        $this->assertNull(collect($groups)->firstWhere('phone', '0812223333'));
    }

    // ---- fixtures ----------------------------------------------------------

    private function as(string $token): self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    private function login(string $email): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/admin/login', ['email' => $email, 'password' => 'password'])->json('token');
    }

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    private function staff(string $roleCode): User
    {
        $user = User::create([
            'name' => "staff-{$roleCode}",
            'display_name' => "staff-{$roleCode}",
            'email' => "{$roleCode}@merge.test",
            'password' => bcrypt('password'),
            'status' => 'active',
        ]);

        OrganizationUser::create([
            'organization_id' => $this->org()->id,
            'user_id' => $user->id,
            'role_id' => Role::where('code', $roleCode)->value('id'),
            'display_name' => $user->display_name,
            'status' => 'active',
            'joined_at' => now(),
        ]);

        return $user;
    }

    private function bookingBody(array $overrides = []): array
    {
        return array_merge([
            'courtId' => $this->org()->courts()->firstOrFail()->id,
            'date' => now()->addDays(3)->toDateString(),
            'start' => '08:00',
            'end' => '09:00',
            'status' => 'confirmed',
        ], $overrides);
    }

    private function customer(string $name, string $phone): Customer
    {
        return Customer::create([
            'organization_id' => $this->org()->id,
            'display_name' => $name,
            'phone' => $phone,
        ]);
    }

    /**
     * One person entered twice: the walk-in row staff made, and the row created
     * when they finally signed in with LINE.
     */
    private function twoOfTheSamePerson(): array
    {
        $keep = $this->customer('คุณประจำ', '081-222-3333');
        Membership::create([
            'organization_id' => $keep->organization_id, 'customer_id' => $keep->id,
            'tier' => 'Silver', 'member_id' => 'SM-KEEP', 'points' => 30, 'lifetime_points' => 30,
            'expires_on' => now()->addMonths(3),
        ]);
        Wallet::create(['organization_id' => $keep->organization_id, 'customer_id' => $keep->id, 'balance' => 100]);
        $this->booking($keep, '14:00', '15:00');

        $dupe = $this->customer('คุณประจำ (LINE)', '0812223333');
        $dupe->update(['line_user_id' => 'Uduplicate']);
        Membership::create([
            'organization_id' => $dupe->organization_id, 'customer_id' => $dupe->id,
            'tier' => 'Silver', 'member_id' => 'SM-DUPE', 'points' => 100, 'lifetime_points' => 100,
            'expires_on' => now()->addYear(),
        ]);
        Wallet::create(['organization_id' => $dupe->organization_id, 'customer_id' => $dupe->id, 'balance' => 150]);
        $this->booking($dupe, '15:00', '16:00');

        return [$keep, $dupe];
    }

    private function booking(Customer $customer, string $start, string $end): Booking
    {
        $court = $this->org()->courts()->firstOrFail();

        return Booking::create([
            'organization_id' => $this->org()->id,
            'branch_id' => $court->branch_id,
            'court_id' => $court->id,
            'customer_id' => $customer->id,
            'code' => 'BKMERGE'.random_int(1000, 9999),
            'date' => now()->addDays(5)->toDateString(),
            'start' => $start,
            'end' => $end,
            'amount' => 300,
            'status' => 'confirmed',
            'channel' => 'walkin',
        ]);
    }

    /**
     * @return string[]
     *
     * Asked through the schema builder rather than sqlite_master: this suite
     * runs against MySQL too, and a query only SQLite understands would make
     * this guard silently skip on the database production actually uses.
     */
    private function tablesWithCustomerId(): array
    {
        return collect(Schema::getTableListing(schema: null, schemaQualified: false))
            ->filter(fn ($t) => Schema::hasColumn($t, 'customer_id'))
            ->values()
            ->all();
    }
}
