<?php

namespace Tests\Feature;

use App\Models\Court;
use App\Models\Organization;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A booking carries what its court IS, not just what it is called.
 *
 * The customer's booking screen drew a hard-coded shuttlecock for every booking
 * on the platform, because the payload gave it a court NAME and nothing else —
 * so someone at a tennis club finished booking a tennis court and was shown
 * badminton. The picture can only be right if these two fields travel with the
 * booking, which is what this pins.
 */
class BookingCourtIdentityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    private function customerToken(string $lineUserId = 'Ucourtident'): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => $lineUserId,
            'displayName' => 'Court Identity',
        ])->json('token');
    }

    private function bookOn(Court $court, string $token): array
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $court->id,
            'date' => now()->addDay()->toDateString(),
            'start' => '18:00',
            'end' => '19:00',
        ])->assertCreated()->json('data');
    }

    public function test_a_booking_says_which_sport_its_court_is(): void
    {
        $court = $this->org()->courts()->firstOrFail();
        $court->update(['sport' => 'tennis']);

        $booking = $this->bookOn($court, $this->customerToken());

        $this->assertSame('tennis', $booking['courtSport'],
            'the screen cannot draw the right sport if the booking does not say what it was');
    }

    public function test_a_booking_carries_the_courts_photo_when_the_venue_uploaded_one(): void
    {
        $court = $this->org()->courts()->firstOrFail();
        $court->update(['image_url' => 'https://cdn.example.test/court-1.jpg']);

        $booking = $this->bookOn($court, $this->customerToken('Ucourtphoto'));

        $this->assertSame('https://cdn.example.test/court-1.jpg', $booking['courtImageUrl']);
    }

    /** No photo is the normal case, and must arrive as null rather than absent. */
    public function test_no_photo_is_null_not_missing(): void
    {
        $court = $this->org()->courts()->firstOrFail();
        $court->update(['image_url' => null]);

        $booking = $this->bookOn($court, $this->customerToken('Ucourtnophoto'));

        $this->assertArrayHasKey('courtImageUrl', $booking);
        $this->assertNull($booking['courtImageUrl']);
    }

    /**
     * A booking outlives the court it was made on.
     *
     * Both fields are read through the relation, so a court the venue has since
     * removed must leave the booking readable rather than take the screen down.
     */
    public function test_a_booking_whose_court_is_gone_still_renders(): void
    {
        $court = $this->org()->courts()->firstOrFail();
        $token = $this->customerToken('Ucourtgone');
        $booking = $this->bookOn($court, $token);

        $court->delete();

        $this->app['auth']->forgetGuards();
        $res = $this->withToken($token)->getJson("/api/v1/bookings/{$booking['id']}")->assertOk();

        $this->assertNull($res->json('data.courtSport'));
        $this->assertNull($res->json('data.courtImageUrl'));
    }

    /**
     * The venue's sport list has to know about that sport, or the picture is
     * still wrong.
     *
     * `sportMeta` was built from what BRANCHES advertise. A court's sport is
     * edited on a different screen, so the two drift — and a tennis court at a
     * venue whose branch still says "badminton" resolved to no catalogue entry,
     * which the app draws as a neutral 🏟️. Carrying `courtSport` on the booking
     * is only half the fix; this is the other half.
     */
    public function test_a_courts_sport_reaches_the_venues_public_sport_list(): void
    {
        $court = $this->org()->courts()->firstOrFail();
        $court->update(['sport' => 'tennis']);

        $res = $this->getJson('/api/v1/orgs/everyday-badminton/public')->assertOk();

        $this->assertContains('tennis', $res->json('sports'));
        $this->assertContains('🎾', collect($res->json('sportMeta'))->pluck('emoji')->all(),
            'a court whose sport the venue knows must not draw as the unknown-sport placeholder');
    }

    /** The owner's list is the same resource, so it carries them too. */
    public function test_the_owner_list_carries_them_as_well(): void
    {
        $court = $this->org()->courts()->firstOrFail();
        $court->update(['sport' => 'futsal']);
        $this->bookOn($court, $this->customerToken('Ucourtowner'));

        $this->app['auth']->forgetGuards();
        $token = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/owner/bookings')
            ->assertOk()
            ->assertJsonPath('data.0.courtSport', 'futsal');
    }
}
