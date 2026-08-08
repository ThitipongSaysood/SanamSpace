<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\CustomerPackage;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The two things a customer can hold with a venue, and the difference.
 *
 * Credit is hours of court time; the wallet is baht. They are not the same and
 * are never added together — converting one to the other needs a rate nobody
 * agreed on.
 *
 * The wallet was the worse half: `wallet` was an accepted payment-method string
 * with no code behind it, so money went in via top-ups and refunds and nothing
 * could ever spend it.
 */
class CustomerCreditTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function token(string $lineId = 'Ucredit'): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/line/login', [
            'organizationSlug' => 'everyday-badminton',
            'lineUserId' => $lineId,
            'displayName' => 'คุณเครดิต',
        ])->json('token');
    }

    private function ownerToken(): string
    {
        $this->app['auth']->forgetGuards();

        $t = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');

        $this->app['auth']->forgetGuards();

        return $t;
    }

    private function customer(): Customer
    {
        return Customer::where('line_user_id', 'Ucredit')->firstOrFail();
    }

    private function book(string $token, string $date = '2027-01-10'): array
    {
        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');
        $this->app['auth']->forgetGuards();

        return $this->withToken($token)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => $date,
            'start' => '18:00',
            'end' => '19:00',
        ])->assertCreated()->json('data');
    }

    private function fund(float $amount): void
    {
        $c = $this->customer();
        Wallet::create(['organization_id' => $c->organization_id, 'customer_id' => $c->id, 'balance' => $amount]);
    }

    // ---- spending the wallet ---------------------------------------------

    /** The whole point: the balance can now actually pay for something. */
    public function test_a_booking_can_be_paid_from_the_wallet(): void
    {
        $token = $this->token();
        $this->fund(1000);
        $booking = $this->book($token);

        $this->app['auth']->forgetGuards();
        $after = $this->withToken($token)
            ->postJson("/api/v1/bookings/{$booking['id']}/pay-with-credit")
            ->assertOk()->json('data');

        $this->assertSame('confirmed', $after['status']);
        $this->assertSame(0.0, (float) $after['outstandingAmount']);
        $this->assertSame(750.0, (float) Wallet::where('customer_id', $this->customer()->id)->value('balance'));
    }

    /** Settled on the spot — the venue already holds the money. */
    public function test_paying_from_credit_needs_no_slip(): void
    {
        $token = $this->token();
        $this->fund(1000);
        $booking = $this->book($token);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$booking['id']}/pay-with-credit")->assertOk();

        $payment = Payment::where('booking_id', $booking['id'])->first();

        $this->assertSame('credit', $payment->method);
        $this->assertSame('approved', $payment->status);
        $this->assertNull($payment->slip_url);
    }

    /** The statement has to show the money leaving, not just the balance drop. */
    public function test_spending_writes_a_negative_transaction(): void
    {
        $token = $this->token();
        $this->fund(500);
        $booking = $this->book($token);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$booking['id']}/pay-with-credit")->assertOk();

        $walletId = Wallet::where('customer_id', $this->customer()->id)->value('id');
        $txn = WalletTransaction::where('wallet_id', $walletId)->latest('created_at')->first();

        $this->assertSame(-250.0, (float) $txn->amount);
        $this->assertStringContainsString($booking['code'], $txn->label);
    }

    /** Not enough money is a refusal with the shortfall, not a negative balance. */
    public function test_an_insufficient_balance_is_refused(): void
    {
        $token = $this->token();
        $this->fund(100);
        $booking = $this->book($token);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)
            ->postJson("/api/v1/bookings/{$booking['id']}/pay-with-credit")
            ->assertStatus(422);

        $this->assertSame(100.0, (float) Wallet::where('customer_id', $this->customer()->id)->value('balance'));
    }

    /** A partial payment is better than a balance nobody can use. */
    public function test_part_of_a_booking_can_be_paid_from_the_wallet(): void
    {
        $token = $this->token();
        $this->fund(100);
        $booking = $this->book($token);

        $this->app['auth']->forgetGuards();
        $after = $this->withToken($token)
            ->postJson("/api/v1/bookings/{$booking['id']}/pay-with-credit", ['amount' => 100])
            ->assertOk()->json('data');

        $this->assertSame(150.0, (float) $after['outstandingAmount']);
        $this->assertSame(0.0, (float) Wallet::where('customer_id', $this->customer()->id)->value('balance'));
    }

    /** Paying twice must not spend it twice. */
    public function test_a_settled_booking_cannot_be_paid_again_from_the_wallet(): void
    {
        $token = $this->token();
        $this->fund(1000);
        $booking = $this->book($token);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$booking['id']}/pay-with-credit")->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$booking['id']}/pay-with-credit")->assertStatus(422);

        $this->assertSame(750.0, (float) Wallet::where('customer_id', $this->customer()->id)->value('balance'));
    }

    /** Another customer's wallet is not reachable through someone else's booking. */
    public function test_a_booking_of_another_customer_cannot_be_paid(): void
    {
        $mine = $this->token();
        $this->fund(1000);

        $theirs = $this->token('Uother');
        $booking = $this->book($theirs, '2027-01-11');

        $this->app['auth']->forgetGuards();
        $this->withToken($mine)
            ->postJson("/api/v1/bookings/{$booking['id']}/pay-with-credit")
            ->assertNotFound();
    }

    // ---- what the venue can see and grant ---------------------------------

    /** Staff need to see who holds what without opening each customer. */
    public function test_the_customers_list_shows_the_credit_balance(): void
    {
        $this->token();
        $c = $this->customer();
        $this->fund(300);
        CustomerPackage::create([
            'organization_id' => $c->organization_id,
            'customer_id' => $c->id,
            'name' => 'แพ็ก 10 ชม.',
            'total_hours' => 10,
            'remaining_hours' => 6,
            'status' => 'active',
        ]);

        $rows = $this->withToken($this->ownerToken())
            ->getJson('/api/v1/owner/customers?perPage=200')->assertOk()->json('data');

        $row = collect($rows)->firstWhere('id', $c->id);

        $this->assertSame(300.0, (float) $row['creditBalance'], 'credit in baht is the balance');
        $this->assertSame(6.0, (float) $row['creditHours'], 'old package hours stay visible');
    }

    /** Granting credit creates its own package, so the history stays readable. */
    public function test_staff_can_grant_credit_hours(): void
    {
        $this->token();
        $c = $this->customer();

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/customer-credit/{$c->id}/hours", ['hours' => 5, 'name' => 'ชดเชยคอร์ทเสีย'])
            ->assertCreated()
            ->assertJsonPath('data.remainingHours', 5);

        $package = CustomerPackage::where('customer_id', $c->id)->first();

        $this->assertSame('ชดเชยคอร์ทเสีย', $package->name);
        // Granted, not sold — revenue must not count it.
        $this->assertSame(0.0, (float) $package->price);
    }

    /** Granted hours are spendable like any other credit. */
    public function test_granted_hours_can_pay_for_a_booking(): void
    {
        $token = $this->token();
        $c = $this->customer();

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/customer-credit/{$c->id}/hours", ['hours' => 5])
            ->assertCreated();

        $booking = $this->book($token, '2027-01-12');
        $packageId = CustomerPackage::where('customer_id', $c->id)->value('id');

        $this->app['auth']->forgetGuards();
        $after = $this->withToken($token)
            ->postJson("/api/v1/bookings/{$booking['id']}/pay-with-package", ['customerPackageId' => $packageId])
            ->assertOk()->json('data');

        $this->assertSame(0.0, (float) $after['amount']);
        $this->assertSame(4.0, (float) CustomerPackage::find($packageId)->remaining_hours);
    }

    /** Granting 100 instead of 10 needs a way back. */
    public function test_staff_can_take_granted_hours_back(): void
    {
        $this->token();
        $c = $this->customer();
        $owner = $this->ownerToken();

        $this->withToken($owner)->postJson("/api/v1/owner/customer-credit/{$c->id}/hours", ['hours' => 10])->assertCreated();
        $this->withToken($owner)->postJson("/api/v1/owner/customer-credit/{$c->id}/hours/deduct", ['hours' => 7])
            ->assertOk()
            ->assertJsonPath('data.creditHours', 3);

        $this->assertSame(3.0, (float) CustomerPackage::where('customer_id', $c->id)->sum('remaining_hours'));
    }

    /** Taking back more than they hold would invent a negative balance. */
    public function test_more_hours_cannot_be_taken_back_than_exist(): void
    {
        $this->token();
        $c = $this->customer();
        $owner = $this->ownerToken();

        $this->withToken($owner)->postJson("/api/v1/owner/customer-credit/{$c->id}/hours", ['hours' => 2])->assertCreated();
        $this->withToken($owner)->postJson("/api/v1/owner/customer-credit/{$c->id}/hours/deduct", ['hours' => 5])
            ->assertStatus(422);

        $this->assertSame(2.0, (float) CustomerPackage::where('customer_id', $c->id)->sum('remaining_hours'));
    }

    /** One control, both directions — "adjust" is what staff are doing. */
    public function test_staff_can_adjust_the_wallet_both_ways(): void
    {
        $this->token();
        $c = $this->customer();
        $owner = $this->ownerToken();

        $this->withToken($owner)->postJson("/api/v1/owner/customer-credit/{$c->id}/adjust", ['amount' => 500])
            ->assertOk()->assertJsonPath('data.balance', 500);

        $this->withToken($owner)->postJson("/api/v1/owner/customer-credit/{$c->id}/adjust", ['amount' => -200])
            ->assertOk()->assertJsonPath('data.balance', 300);
    }

    /** Taking out more than is there is refused, not allowed to go negative. */
    public function test_the_wallet_cannot_be_adjusted_below_zero(): void
    {
        $this->token();
        $c = $this->customer();

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/customer-credit/{$c->id}/adjust", ['amount' => -50])
            ->assertStatus(422);
    }

    // ---- cancelling pays back in credit -----------------------------------

    /**
     * The venue's policy: cancel and the money comes back as credit, not cash.
     * Immediately, because credit costs the venue nothing to return.
     */
    public function test_cancelling_a_paid_booking_returns_the_money_as_credit(): void
    {
        $token = $this->token();
        $this->fund(1000);
        $booking = $this->book($token, '2027-04-01');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$booking['id']}/pay-with-credit")->assertOk();
        $this->assertSame(750.0, (float) Wallet::where('customer_id', $this->customer()->id)->value('balance'));

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$booking['id']}/cancel")->assertOk();

        $this->assertSame(1000.0, (float) Wallet::where('customer_id', $this->customer()->id)->value('balance'));
    }

    /** Equipment money comes back to the same place — it is baht either way. */
    public function test_the_rental_part_comes_back_as_credit_too(): void
    {
        // The org directly: the customer does not exist until the token below.
        $racket = \App\Models\RentalItem::create([
            'organization_id' => Organization::where('slug', 'everyday-badminton')->value('id'),
            'name' => 'ไม้แบด',
            'price' => 60,
            'price_unit' => 'per_session',
            'stock_qty' => 4,
        ]);

        $token = $this->token();
        $this->fund(1000);

        $courtId = $this->getJson('/api/v1/courts?venueId=everyday-badminton')->json('data.0.id');
        $this->app['auth']->forgetGuards();
        $booking = $this->withToken($token)->postJson('/api/v1/bookings', [
            'venueId' => 'everyday-badminton',
            'courtId' => $courtId,
            'date' => '2027-04-02',
            'start' => '18:00',
            'end' => '19:00',
            'rentals' => [['itemId' => $racket->id, 'quantity' => 1]],
        ])->assertCreated()->json('data');

        $this->assertSame(310.0, (float) $booking['amount']); // 250 court + 60 racket

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$booking['id']}/pay-with-credit")->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$booking['id']}/cancel")->assertOk();

        // The whole ฿310 is back — court and racket are both baht.
        $this->assertSame(1000.0, (float) Wallet::where('customer_id', $this->customer()->id)->value('balance'));
    }

    /** Cancelling something nobody paid for gives nothing back. */
    public function test_cancelling_an_unpaid_booking_credits_nothing(): void
    {
        $token = $this->token();
        $this->fund(500);
        $booking = $this->book($token, '2027-04-03');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$booking['id']}/cancel")->assertOk();

        $this->assertSame(500.0, (float) Wallet::where('customer_id', $this->customer()->id)->value('balance'));
    }

    /** Cancelling twice must not pay out twice. */
    public function test_a_second_cancel_does_not_refund_again(): void
    {
        $token = $this->token();
        $this->fund(1000);
        $booking = $this->book($token, '2027-04-04');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$booking['id']}/pay-with-credit")->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$booking['id']}/cancel")->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$booking['id']}/cancel")->assertStatus(422);

        $this->assertSame(1000.0, (float) Wallet::where('customer_id', $this->customer()->id)->value('balance'));
    }

    /** The refund shows in the history as a refund, not as a staff adjustment. */
    public function test_the_cancellation_refund_is_labelled_as_one(): void
    {
        $token = $this->token();
        $this->fund(1000);
        $booking = $this->book($token, '2027-04-05');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$booking['id']}/pay-with-credit")->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$booking['id']}/cancel")->assertOk();

        $rows = $this->withToken($this->ownerToken())
            ->getJson("/api/v1/owner/customer-credit/{$this->customer()->id}/history")
            ->assertOk()->json('data');

        $this->assertSame('refund', $rows[0]['source']);
        $this->assertNull($rows[0]['byName'], 'the customer cancelled; no staff member did this');
        $this->assertStringContainsString($booking['code'], $rows[0]['label']);
    }

    // ---- the audit trail --------------------------------------------------

    /**
     * Credit is money staff can create by hand, so every line has to name a
     * hand. A balance cannot answer "who gave this customer ฿5,000".
     */
    public function test_a_staff_adjustment_records_who_made_it(): void
    {
        $this->token();
        $c = $this->customer();

        $this->withToken($this->ownerToken())
            ->postJson("/api/v1/owner/customer-credit/{$c->id}/adjust", ['amount' => 5000, 'label' => 'ชดเชย'])
            ->assertOk();

        $rows = $this->withToken($this->ownerToken())
            ->getJson("/api/v1/owner/customer-credit/{$c->id}/history")
            ->assertOk()->json('data');

        $this->assertCount(1, $rows);
        $this->assertSame(5000.0, (float) $rows[0]['amount']);
        $this->assertSame('adjustment', $rows[0]['source']);
        $this->assertSame('Everyday Owner', $rows[0]['byName']);
        $this->assertSame('ชดเชย', $rows[0]['label']);
    }

    /** Taking credit away is just as answerable as giving it. */
    public function test_a_deduction_is_recorded_with_its_actor_too(): void
    {
        $this->token();
        $c = $this->customer();
        $owner = $this->ownerToken();

        $this->withToken($owner)->postJson("/api/v1/owner/customer-credit/{$c->id}/adjust", ['amount' => 300])->assertOk();
        $this->withToken($owner)->postJson("/api/v1/owner/customer-credit/{$c->id}/adjust", ['amount' => -100, 'label' => 'ปรับผิด'])->assertOk();

        $rows = $this->withToken($owner)
            ->getJson("/api/v1/owner/customer-credit/{$c->id}/history")->assertOk()->json('data');

        $this->assertCount(2, $rows);
        $this->assertSame(-100.0, (float) $rows[0]['amount'], 'newest first');
        $this->assertSame('Everyday Owner', $rows[0]['byName']);
    }

    /** A customer spending their own credit is not a staff action. */
    public function test_spending_records_no_staff_member(): void
    {
        $token = $this->token();
        $this->fund(1000);
        $booking = $this->book($token, '2027-03-01');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/bookings/{$booking['id']}/pay-with-credit")->assertOk();

        $rows = $this->withToken($this->ownerToken())
            ->getJson("/api/v1/owner/customer-credit/{$this->customer()->id}/history")
            ->assertOk()->json('data');

        $this->assertSame('booking', $rows[0]['source']);
        $this->assertNull($rows[0]['byName'], 'the customer did this, not staff');
    }

    /** Another venue's customer history is not readable. */
    public function test_the_history_is_org_scoped(): void
    {
        $tsr = Organization::where('slug', 'tsr-arena')->firstOrFail();
        $theirs = Customer::create([
            'organization_id' => $tsr->id,
            'display_name' => 'ลูกค้าสนามอื่น',
        ]);

        $this->withToken($this->ownerToken())
            ->getJson("/api/v1/owner/customer-credit/{$theirs->id}/history")
            ->assertNotFound();
    }

    /** Giving away money is not a "view customers" permission. */
    public function test_granting_credit_is_gated(): void
    {
        $this->token();
        $c = $this->customer();

        $user = \App\Models\User::create([
            'name' => 'Viewer', 'display_name' => 'Viewer',
            'email' => 'credit-viewer@everyday.test', 'password' => 'password',
        ]);
        \App\Models\OrganizationUser::create([
            'organization_id' => Organization::where('slug', 'everyday-badminton')->value('id'),
            'user_id' => $user->id,
            'role_id' => \App\Models\Role::where('code', 'viewer')->value('id'),
            'display_name' => $user->display_name,
            'status' => 'active',
            'joined_at' => now(),
        ]);

        $this->app['auth']->forgetGuards();
        $viewer = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'credit-viewer@everyday.test', 'password' => 'password',
        ])->json('token');

        $this->app['auth']->forgetGuards();
        $this->withToken($viewer)
            ->postJson("/api/v1/owner/customer-credit/{$c->id}/hours", ['hours' => 100])
            ->assertForbidden();
    }
}
