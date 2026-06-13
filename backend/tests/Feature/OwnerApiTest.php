<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Court;
use App\Models\Customer;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\User;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OwnerApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    /** Admin (staff) bearer token for the seeded Everyday owner. */
    private function ownerToken(): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');
    }

    private function customerToken(string $lineUserId = 'Uownertest', string $name = 'Owner Tester'): string
    {
        return $this->postJson('/api/v1/auth/line/login', [
            'lineUserId' => $lineUserId,
            'displayName' => $name,
        ])->json('token');
    }

    private function everydayCourtId(): string
    {
        return $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');
    }

    public function test_dashboard_returns_org_stats(): void
    {
        $token = $this->ownerToken();

        $this->withToken($token)->getJson('/api/v1/owner/dashboard')
            ->assertOk()
            ->assertJsonStructure([
                'todayBookings', 'todayRevenue', 'pendingSlips',
                'confirmedToday', 'totalCustomers', 'courtCount',
            ])
            // 6 Everyday courts (NOT 10 across both orgs) + the seeded customer.
            ->assertJsonPath('courtCount', 6)
            ->assertJsonPath('totalCustomers', 1);
    }

    public function test_owner_can_list_bookings_with_customer_name(): void
    {
        $customer = $this->customerToken();
        $courtId = $this->everydayCourtId();

        $this->withToken($customer)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => now()->toDateString(),
            'start' => '18:00',
            'end' => '19:00',
        ])->assertCreated();

        $this->app['auth']->forgetGuards();

        $this->withToken($this->ownerToken())->getJson('/api/v1/owner/bookings')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.customerName', 'Owner Tester')
            ->assertJsonPath('data.0.courtName', 'Court 1');
    }

    public function test_owner_verify_slip_flow_confirms_booking(): void
    {
        Storage::fake('public');

        $customer = $this->customerToken();
        $courtId = $this->everydayCourtId();

        $booking = $this->withToken($customer)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => now()->toDateString(),
            'start' => '20:00',
            'end' => '21:00',
        ])->assertCreated();
        $bookingId = $booking->json('data.id');

        $payment = $this->withToken($customer)->postJson('/api/v1/payments', [
            'bookingId' => $bookingId,
            'method' => 'transfer',
        ])->assertCreated();
        $paymentId = $payment->json('data.id');

        $this->withToken($customer)->postJson("/api/v1/payments/{$paymentId}/upload-slip", [
            'slip' => UploadedFile::fake()->image('slip.png', 600, 800),
        ])->assertOk()->assertJsonPath('data.status', 'pending_review');

        $this->app['auth']->forgetGuards();
        $owner = $this->ownerToken();

        // Owner sees the pending slip with booking summary + customerName.
        $this->withToken($owner)->getJson('/api/v1/owner/payments?status=pending_review')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $paymentId)
            ->assertJsonPath('data.0.customerName', 'Owner Tester')
            ->assertJsonPath('data.0.booking.code', $booking->json('data.code'));

        // Owner verifies -> approved + booking confirmed.
        $this->withToken($owner)->postJson("/api/v1/owner/payments/{$paymentId}/verify")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->app['auth']->forgetGuards();
        $this->withToken($owner)->getJson("/api/v1/owner/bookings/{$bookingId}")
            ->assertOk()
            ->assertJsonPath('data.status', 'confirmed');
    }

    public function test_owner_endpoints_are_org_scoped(): void
    {
        // Build a second org's data (TSR Arena) with its own customer + booking + payment.
        $tsr = Organization::where('slug', 'tsr-arena')->firstOrFail();
        $tsrCourt = Court::where('organization_id', $tsr->id)->firstOrFail();

        $tsrCustomer = Customer::create([
            'organization_id' => $tsr->id,
            'line_user_id' => 'Utsrcustomer',
            'display_name' => 'TSR Customer',
        ]);

        $tsrBooking = Booking::create([
            'organization_id' => $tsr->id,
            'branch_id' => $tsrCourt->branch_id,
            'court_id' => $tsrCourt->id,
            'customer_id' => $tsrCustomer->id,
            'code' => 'BKTSR000001',
            'date' => now()->toDateString(),
            'start' => '18:00',
            'end' => '19:00',
            'amount' => 600,
            'status' => 'pending_payment',
        ]);

        $tsrPayment = Payment::create([
            'organization_id' => $tsr->id,
            'booking_id' => $tsrBooking->id,
            'customer_id' => $tsrCustomer->id,
            'method' => 'transfer',
            'amount' => 600,
            'status' => 'pending_review',
        ]);

        $owner = $this->ownerToken(); // Everyday owner

        // Everyday owner sees none of TSR's bookings / payments / customers.
        $this->withToken($owner)->getJson('/api/v1/owner/bookings')
            ->assertOk()->assertJsonCount(0, 'data');

        $this->app['auth']->forgetGuards();
        $this->withToken($owner)->getJson('/api/v1/owner/payments')
            ->assertOk()->assertJsonCount(0, 'data');

        $this->app['auth']->forgetGuards();
        $this->withToken($owner)->getJson('/api/v1/owner/customers')
            ->assertOk()->assertJsonCount(1, 'data'); // only the seeded Everyday customer

        // Cross-org single resource lookups are 404, not 403.
        $this->app['auth']->forgetGuards();
        $this->withToken($owner)->getJson("/api/v1/owner/bookings/{$tsrBooking->id}")
            ->assertNotFound();

        $this->app['auth']->forgetGuards();
        $this->withToken($owner)->postJson("/api/v1/owner/payments/{$tsrPayment->id}/verify")
            ->assertNotFound();

        // The TSR payment/booking were untouched by the cross-org attempt.
        $this->assertSame('pending_review', $tsrPayment->fresh()->status);
        $this->assertSame('pending_payment', $tsrBooking->fresh()->status);

        // Everyday courts only (6), never TSR's 4.
        $this->app['auth']->forgetGuards();
        $this->withToken($owner)->getJson('/api/v1/owner/courts')
            ->assertOk()->assertJsonCount(6, 'data');
    }

    public function test_non_staff_user_is_forbidden(): void
    {
        // A User with no organization membership -> 403.
        $orphan = User::create([
            'name' => 'Orphan',
            'display_name' => 'Orphan',
            'email' => 'orphan@nowhere.test',
            'password' => Hash::make('password'),
        ]);
        $token = $orphan->createToken('admin-token')->plainTextToken;

        $this->withToken($token)->getJson('/api/v1/owner/dashboard')
            ->assertForbidden();

        // A customer token (not a staff User) -> 403.
        $this->app['auth']->forgetGuards();
        $this->withToken($this->customerToken('Ucustfor', 'Cust'))
            ->getJson('/api/v1/owner/dashboard')
            ->assertForbidden();
    }
}
