<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\CustomerTimelineEntry;
use App\Models\Payment;
use App\Services\PersonalDataService;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * PDPA data-subject rights: a copy of my data, and the erasure of it.
 *
 * The tension these lock down is that erasure is **not** deletion of the
 * venue's books. Thai accounting law requires the transactions to survive, so
 * "erase me" has to remove the person while leaving the money.
 */
class PersonalDataTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function token(string $lineUserId = 'Updpa', string $name = 'คุณพีดีพีเอ'): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => $lineUserId,
            'displayName' => $name,
        ])->json('token');
    }

    private function book(string $token, string $date = '2026-11-20'): string
    {
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');

        // Without this the guard stays resolved to whoever authenticated last
        // in this test, and the booking lands on the wrong customer.
        $this->app['auth']->forgetGuards();

        return $this->withToken($token)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => $date,
            'start' => '18:00',
            'end' => '19:00',
        ])->assertCreated()->json('data.id');
    }

    // ---- Right to a copy -------------------------------------------------

    /** The export has to actually contain the person's history, not a stub. */
    public function test_a_customer_can_download_everything_held_about_them(): void
    {
        $token = $this->token();
        $bookingId = $this->book($token);

        $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId,
            'method' => 'transfer',
        ])->assertCreated();

        $body = $this->withToken($token)->getJson('/api/v1/me/data')->assertOk()->json();

        $this->assertSame('คุณพีดีพีเอ', $body['profile']['displayName']);
        $this->assertSame('UPDPA', strtoupper($body['profile']['lineUserId']));
        $this->assertCount(1, $body['bookings']);
        $this->assertSame('Court 1', $body['bookings'][0]['court']);
        $this->assertCount(1, $body['bookings'][0]['payments']);
        $this->assertArrayHasKey('marketingConsent', $body);
        $this->assertArrayHasKey('activityTimeline', $body);
    }

    /** It is a file, not a page — the right is to receive a portable copy. */
    public function test_the_export_downloads_as_a_file(): void
    {
        $response = $this->withToken($this->token())->getJson('/api/v1/me/data')->assertOk();

        $this->assertStringContainsString('attachment;', $response->headers->get('content-disposition'));
        $this->assertStringContainsString('.json', $response->headers->get('content-disposition'));
    }

    /** One customer's export must never reach into another's rows. */
    public function test_an_export_contains_only_that_customers_bookings(): void
    {
        $mine = $this->token('Umine', 'ของฉัน');
        $this->book($mine, '2026-11-21');

        $theirs = $this->token('Utheirs', 'ของเขา');
        $this->book($theirs, '2026-11-22');

        $this->app['auth']->forgetGuards();
        $body = $this->withToken($mine)->getJson('/api/v1/me/data')->assertOk()->json();

        $this->assertCount(1, $body['bookings']);
        $this->assertSame('2026-11-21', $body['bookings'][0]['date']);
    }

    /** Signed out, there is no "me" to export. */
    public function test_the_export_needs_a_login(): void
    {
        $this->getJson('/api/v1/me/data')->assertUnauthorized();
    }

    // ---- Right to erasure ------------------------------------------------

    /** The person goes; the booking and its payment stay on the books. */
    public function test_erasure_removes_the_person_but_keeps_the_accounts(): void
    {
        $token = $this->token();
        $bookingId = $this->book($token);

        $this->withToken($token)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId,
            'method' => 'transfer',
        ])->assertCreated();

        $customerId = Customer::where('line_user_id', 'Updpa')->value('id');
        CustomerTimelineEntry::create([
            'organization_id' => Customer::find($customerId)->organization_id,
            'customer_id' => $customerId,
            'type' => 'note',
            'title' => 'ชอบคอร์ท 1',
            'occurred_at' => now(),
        ]);

        $this->withToken($token)->deleteJson('/api/v1/me', [
            'confirmName' => 'คุณพีดีพีเอ',
        ])->assertOk();

        $erased = Customer::withTrashed()->find($customerId);

        $this->assertSame(PersonalDataService::ERASED_NAME, $erased->display_name);
        $this->assertNull($erased->line_user_id);
        $this->assertNull($erased->phone);
        $this->assertNull($erased->email);
        $this->assertNotNull($erased->deleted_at);
        $this->assertNotNull($erased->unsubscribed_at, 'suppression must survive erasure');

        // The books are untouched.
        $this->assertNotNull(Booking::find($bookingId));
        $this->assertSame(1, Payment::where('booking_id', $bookingId)->count());

        // Personal notes are not the venue's accounts, so they go.
        $this->assertSame(0, CustomerTimelineEntry::where('customer_id', $customerId)->count());
    }

    /** A mis-tap must not erase anyone: the name has to be typed back. */
    public function test_erasure_refuses_without_the_matching_name(): void
    {
        $token = $this->token();

        $this->withToken($token)->deleteJson('/api/v1/me', [
            'confirmName' => 'ชื่ออื่น',
        ])->assertStatus(422);

        $this->assertNotNull(Customer::where('line_user_id', 'Updpa')->first());
    }

    /** Erasure signs every device out — the tokens must stop working. */
    public function test_erasure_revokes_the_session(): void
    {
        $token = $this->token();

        $this->withToken($token)->deleteJson('/api/v1/me', ['confirmName' => 'คุณพีดีพีเอ'])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/bookings')->assertUnauthorized();
    }

    /**
     * Logging in again is a new person, not the old one coming back.
     *
     * This is why `line_user_id` is cleared rather than kept: without that, the
     * next LINE login would find the erased row and undo the erasure.
     */
    public function test_logging_in_again_creates_a_fresh_customer(): void
    {
        $token = $this->token();
        $oldId = Customer::where('line_user_id', 'Updpa')->value('id');

        $this->withToken($token)->deleteJson('/api/v1/me', ['confirmName' => 'คุณพีดีพีเอ'])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->token();

        $newId = Customer::where('line_user_id', 'Updpa')->value('id');

        $this->assertNotNull($newId);
        $this->assertNotSame($oldId, $newId);
    }

    /** An erased customer is never a broadcast recipient again. */
    public function test_an_erased_customer_is_not_marketing_reachable(): void
    {
        $token = $this->token();
        $customerId = Customer::where('line_user_id', 'Updpa')->value('id');

        $this->withToken($token)->deleteJson('/api/v1/me', ['confirmName' => 'คุณพีดีพีเอ'])->assertOk();

        $reachable = Customer::query()->marketingReachable()->pluck('id');

        $this->assertNotContains($customerId, $reachable);
    }
}
