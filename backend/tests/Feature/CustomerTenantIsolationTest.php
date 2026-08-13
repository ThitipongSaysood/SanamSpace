<?php

namespace Tests\Feature;

use App\Models\Court;
use App\Models\Organization;
use App\Models\VenuePackage;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A customer belongs to exactly ONE venue and must never reach another venue's
 * data by submitting that venue's ids. These four write/preview endpoints once
 * resolved their target (court / package / branch) from a CLIENT-supplied id
 * without checking it against the signed-in customer's own organization — so a
 * venue A customer could book, buy, review, or probe coupons at venue B.
 *
 * Each test authenticates as a venue A customer, then acts on a venue B resource
 * whose id it looked up out-of-band, and expects a 404 (a venue's resources must
 * not even be discoverable from another venue's app).
 */
class CustomerTenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    private Organization $venueA;

    private Organization $venueB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
        $this->venueA = Organization::where('slug', 'everyday-badminton')->firstOrFail();
        $this->venueB = Organization::where('slug', 'tsr-arena')->firstOrFail();
    }

    /** Bearer token for a customer that belongs to venue A. */
    private function venueACustomerToken(): string
    {
        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => $this->venueA->slug,
            'lineUserId' => 'Uisolationtester',
            'displayName' => 'Isolation Tester',
        ])->json('token');
    }

    private function venueBCourtId(): string
    {
        return (string) Court::where('organization_id', $this->venueB->id)->value('id');
    }

    public function test_customer_cannot_book_a_court_in_another_venue(): void
    {
        $res = $this->withToken($this->venueACustomerToken())->postJson('/api/v1/bookings', [
            'venueId' => $this->venueB->slug,
            'courtId' => $this->venueBCourtId(),
            'date' => '2026-06-20',
            'start' => '18:00',
            'end' => '19:00',
        ]);

        $res->assertStatus(404);
        $this->assertDatabaseMissing('bookings', ['organization_id' => $this->venueB->id]);
    }

    public function test_customer_can_still_book_their_own_venue(): void
    {
        // Positive control: the isolation guard must not break the legit path.
        $courtId = Court::where('organization_id', $this->venueA->id)->value('id');

        $this->withToken($this->venueACustomerToken())->postJson('/api/v1/bookings', [
            'venueId' => $this->venueA->slug,
            'courtId' => $courtId,
            'date' => '2026-06-20',
            'start' => '18:00',
            'end' => '19:00',
        ])->assertCreated()->assertJsonPath('data.venueId', $this->venueA->slug);
    }

    public function test_customer_cannot_preview_another_venues_coupon(): void
    {
        $this->withToken($this->venueACustomerToken())->postJson('/api/v1/coupons/preview', [
            'courtId' => $this->venueBCourtId(),
            'code' => 'ANYCODE',
            'amount' => 100,
        ])->assertStatus(404);
    }

    public function test_customer_cannot_purchase_another_venues_package(): void
    {
        $packageB = VenuePackage::create([
            'organization_id' => $this->venueB->id,
            'name' => 'B-only pack',
            'hours' => 10,
            'price' => 2500,
            'valid_days' => 90,
            'sort_order' => 0,
        ]);

        $this->withToken($this->venueACustomerToken())
            ->postJson("/api/v1/packages/{$packageB->id}/purchase")
            ->assertStatus(404);

        $this->assertDatabaseMissing('customer_packages', ['venue_package_id' => $packageB->id]);
    }

    public function test_customer_cannot_review_another_venue(): void
    {
        $this->withToken($this->venueACustomerToken())->postJson('/api/v1/reviews', [
            'venueId' => $this->venueB->slug,
            'rating' => 5,
            'text' => 'cross-tenant review attempt',
        ])->assertStatus(404);

        $this->assertDatabaseMissing('reviews', [
            'organization_id' => $this->venueB->id,
            'text' => 'cross-tenant review attempt',
        ]);
    }
}
