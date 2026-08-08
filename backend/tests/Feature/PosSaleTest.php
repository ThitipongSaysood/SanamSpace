<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Product;
use App\Models\ProductSale;
use App\Models\Role;
use App\Models\User;
use App\Services\PosService;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The counter's till.
 *
 * Mostly about the two ways a POS quietly loses money: selling stock that is
 * not there, and a receipt whose numbers change after the fact.
 */
class PosSaleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function as(string $token): self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    private function login(string $email = 'owner@everyday.test'): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => $email,
            'password' => 'password',
        ])->json('token');
    }

    private function org(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    private function product(array $attrs = []): Product
    {
        return Product::create(array_merge([
            'organization_id' => $this->org()->id,
            'name' => 'น้ำเปล่า',
            'price' => 15,
            'stock_qty' => 10,
            'low_stock_threshold' => 3,
        ], $attrs));
    }

    /** A staff member at the seeded venue carrying the given system role. */
    private function staffToken(string $roleCode): string
    {
        $user = User::create([
            'name' => "Staff {$roleCode}",
            'display_name' => "Staff {$roleCode}",
            'email' => "pos-{$roleCode}@everyday.test",
            'password' => 'password',
        ]);

        OrganizationUser::create([
            'organization_id' => $this->org()->id,
            'user_id' => $user->id,
            'role_id' => Role::where('code', $roleCode)->value('id'),
            'display_name' => $user->display_name,
            'status' => 'active',
            'joined_at' => now(),
        ]);

        return $this->login($user->email);
    }

    // --- selling ------------------------------------------------------------

    public function test_a_sale_charges_the_right_total_and_moves_the_stock(): void
    {
        $water = $this->product(['name' => 'น้ำเปล่า', 'price' => 15, 'stock_qty' => 10]);
        $drink = $this->product(['name' => 'อิเลคโทรไลต์', 'price' => 25, 'stock_qty' => 4]);

        $body = $this->as($this->login())->postJson('/api/v1/owner/sales', [
            'items' => [
                ['productId' => $water->id, 'quantity' => 2],
                ['productId' => $drink->id, 'quantity' => 1],
            ],
            'paymentMethod' => 'cash',
        ])->assertCreated()->json('data');

        // Cast: JSON serialises a whole float as an int, so 55.0 arrives as 55.
        $this->assertSame(55.0, (float) $body['total']); // 15*2 + 25
        $this->assertCount(2, $body['items']);
        $this->assertSame(8, $water->fresh()->stock_qty);
        $this->assertSame(3, $drink->fresh()->stock_qty);
    }

    /** Two taps on the same bottle is one line of two, and must be stocked as two. */
    public function test_duplicate_lines_are_merged_before_the_stock_check(): void
    {
        $water = $this->product(['stock_qty' => 3]);

        $this->as($this->login())->postJson('/api/v1/owner/sales', [
            'items' => [
                ['productId' => $water->id, 'quantity' => 2],
                ['productId' => $water->id, 'quantity' => 2],
            ],
            'paymentMethod' => 'cash',
        ])->assertStatus(422);

        // Nothing sold, nothing moved — the pair was checked, not each half.
        $this->assertSame(3, $water->fresh()->stock_qty);
        $this->assertSame(0, ProductSale::count());
    }

    /** The refusal has to tell the person at the till what to put back. */
    public function test_selling_more_than_the_shelf_holds_is_refused_by_name(): void
    {
        $water = $this->product(['name' => 'ลูกขนไก่', 'stock_qty' => 2]);

        $response = $this->as($this->login())->postJson('/api/v1/owner/sales', [
            'items' => [['productId' => $water->id, 'quantity' => 5]],
            'paymentMethod' => 'cash',
        ])->assertStatus(422);

        $message = implode(' ', $response->json('errors.items'));
        $this->assertStringContainsString('ลูกขนไก่', $message);
        $this->assertStringContainsString('2', $message);
    }

    /** A sale that cannot be fully stocked must take nothing at all. */
    public function test_a_partly_unstocked_basket_sells_nothing(): void
    {
        $ok = $this->product(['name' => 'มีของ', 'stock_qty' => 10]);
        $short = $this->product(['name' => 'ของหมด', 'stock_qty' => 1]);

        $this->as($this->login())->postJson('/api/v1/owner/sales', [
            'items' => [
                ['productId' => $ok->id, 'quantity' => 2],
                ['productId' => $short->id, 'quantity' => 5],
            ],
            'paymentMethod' => 'cash',
        ])->assertStatus(422);

        // The first line must not have been taken on the way to failing.
        $this->assertSame(10, $ok->fresh()->stock_qty);
        $this->assertSame(1, $short->fresh()->stock_qty);
        $this->assertSame(0, ProductSale::count());
    }

    public function test_an_inactive_product_cannot_be_sold(): void
    {
        $hidden = $this->product(['is_active' => false]);

        $this->as($this->login())->postJson('/api/v1/owner/sales', [
            'items' => [['productId' => $hidden->id, 'quantity' => 1]],
            'paymentMethod' => 'cash',
        ])->assertStatus(422);
    }

    /** Another venue's product is not on this till. */
    public function test_a_product_from_another_venue_cannot_be_sold(): void
    {
        $other = Organization::where('slug', '!=', 'everyday-badminton')->firstOrFail();
        $theirs = Product::create([
            'organization_id' => $other->id,
            'name' => 'ของสนามอื่น',
            'price' => 20,
            'stock_qty' => 10,
        ]);

        $this->as($this->login())->postJson('/api/v1/owner/sales', [
            'items' => [['productId' => $theirs->id, 'quantity' => 1]],
            'paymentMethod' => 'cash',
        ])->assertStatus(422);

        $this->assertSame(10, $theirs->fresh()->stock_qty);
    }

    // --- the receipt is a record --------------------------------------------

    /**
     * Renaming or repricing a product must not rewrite what a customer was
     * charged last week.
     */
    public function test_a_receipt_keeps_the_name_and_price_it_was_sold_at(): void
    {
        $water = $this->product(['name' => 'น้ำเปล่า', 'price' => 15]);

        $saleId = $this->as($this->login())->postJson('/api/v1/owner/sales', [
            'items' => [['productId' => $water->id, 'quantity' => 1]],
            'paymentMethod' => 'cash',
        ])->assertCreated()->json('data.id');

        $water->update(['name' => 'น้ำแร่พรีเมียม', 'price' => 40]);

        $body = $this->as($this->login())->getJson("/api/v1/owner/sales/{$saleId}")
            ->assertOk()
            ->json('data');

        $this->assertSame('น้ำเปล่า', $body['items'][0]['name']);
        $this->assertSame(15.0, (float) $body['items'][0]['unitPrice']);
        $this->assertSame(15.0, (float) $body['total']);
    }

    // --- voiding ------------------------------------------------------------

    public function test_voiding_puts_the_stock_back_and_keeps_the_record(): void
    {
        $water = $this->product(['stock_qty' => 10]);
        $token = $this->login();

        $saleId = $this->as($token)->postJson('/api/v1/owner/sales', [
            'items' => [['productId' => $water->id, 'quantity' => 3]],
            'paymentMethod' => 'cash',
        ])->assertCreated()->json('data.id');

        $this->assertSame(7, $water->fresh()->stock_qty);

        $this->as($token)->postJson("/api/v1/owner/sales/{$saleId}/void", ['reason' => 'กดผิด'])
            ->assertOk()
            ->assertJsonPath('data.status', 'voided')
            ->assertJsonPath('data.voidReason', 'กดผิด');

        $this->assertSame(10, $water->fresh()->stock_qty);
        // The receipt survives — a hole in the day's takings helps nobody.
        $this->assertDatabaseHas('product_sales', ['id' => $saleId, 'status' => 'voided']);
    }

    /** Voiding twice must not hand back the stock twice. */
    public function test_a_sale_cannot_be_voided_twice(): void
    {
        $water = $this->product(['stock_qty' => 10]);
        $token = $this->login();

        $saleId = $this->as($token)->postJson('/api/v1/owner/sales', [
            'items' => [['productId' => $water->id, 'quantity' => 3]],
            'paymentMethod' => 'cash',
        ])->json('data.id');

        $this->as($token)->postJson("/api/v1/owner/sales/{$saleId}/void")->assertOk();
        $this->as($token)->postJson("/api/v1/owner/sales/{$saleId}/void")->assertStatus(422);

        $this->assertSame(10, $water->fresh()->stock_qty);
    }

    // --- the day's takings ---------------------------------------------------

    public function test_the_summary_splits_cash_from_transfer_and_excludes_voids(): void
    {
        $water = $this->product(['price' => 10, 'stock_qty' => 100]);
        $token = $this->login();

        $this->as($token)->postJson('/api/v1/owner/sales', [
            'items' => [['productId' => $water->id, 'quantity' => 2]], 'paymentMethod' => 'cash',
        ])->assertCreated();

        $this->as($token)->postJson('/api/v1/owner/sales', [
            'items' => [['productId' => $water->id, 'quantity' => 3]], 'paymentMethod' => 'transfer',
        ])->assertCreated();

        $voided = $this->as($token)->postJson('/api/v1/owner/sales', [
            'items' => [['productId' => $water->id, 'quantity' => 5]], 'paymentMethod' => 'cash',
        ])->json('data.id');
        $this->as($token)->postJson("/api/v1/owner/sales/{$voided}/void")->assertOk();

        $summary = $this->as($token)->getJson('/api/v1/owner/sales/summary')
            ->assertOk()
            ->assertJsonPath('saleCount', 2)
            ->assertJsonPath('voidedCount', 1)
            ->json();

        $this->assertSame(50.0, (float) $summary['total']);          // 20 cash + 30 transfer
        $this->assertSame(20.0, (float) $summary['cashTotal']);
        $this->assertSame(30.0, (float) $summary['transferTotal']);
    }

    // --- stock management ----------------------------------------------------

    public function test_restocking_adds_and_a_stock_take_sets(): void
    {
        $water = $this->product(['stock_qty' => 4]);
        $token = $this->login();

        $this->as($token)->postJson("/api/v1/owner/products/{$water->id}/stock", ['delta' => 24])
            ->assertOk()
            ->assertJsonPath('data.stockQty', 28);

        $this->as($token)->postJson("/api/v1/owner/products/{$water->id}/stock", ['set' => 6])
            ->assertOk()
            ->assertJsonPath('data.stockQty', 6);

        // A count below zero is a mistake, not a fact.
        $this->as($token)->postJson("/api/v1/owner/products/{$water->id}/stock", ['delta' => -99])
            ->assertOk()
            ->assertJsonPath('data.stockQty', 0);
    }

    public function test_stock_state_tells_the_till_what_to_warn_about(): void
    {
        $this->product(['name' => 'พอ', 'stock_qty' => 20, 'low_stock_threshold' => 3]);
        $this->product(['name' => 'ใกล้หมด', 'stock_qty' => 2, 'low_stock_threshold' => 3]);
        $this->product(['name' => 'หมด', 'stock_qty' => 0]);

        $rows = collect($this->as($this->login())->getJson('/api/v1/owner/products')->assertOk()->json('data'))
            ->keyBy('name');

        $this->assertSame('ok', $rows['พอ']['stockState']);
        $this->assertSame('low', $rows['ใกล้หมด']['stockState']);
        $this->assertSame('out', $rows['หมด']['stockState']);
    }

    // --- who may do what -----------------------------------------------------

    /** Selling is counter work; changing prices and voiding are not. */
    public function test_a_cashier_can_sell_but_not_void_or_edit_the_catalogue(): void
    {
        $water = $this->product(['stock_qty' => 10]);
        $cashier = $this->staffToken('cashier');

        $saleId = $this->as($cashier)->postJson('/api/v1/owner/sales', [
            'items' => [['productId' => $water->id, 'quantity' => 1]],
            'paymentMethod' => 'cash',
        ])->assertCreated()->json('data.id');

        $this->as($cashier)->postJson("/api/v1/owner/sales/{$saleId}/void")->assertForbidden();

        $this->as($cashier)->postJson('/api/v1/owner/products', [
            'name' => 'ของใหม่', 'price' => 10,
        ])->assertForbidden();
    }

    public function test_a_role_without_pos_cannot_reach_the_till(): void
    {
        $marketing = $this->staffToken('marketing');

        $this->as($marketing)->getJson('/api/v1/owner/products')->assertForbidden();
        $this->as($marketing)->getJson('/api/v1/owner/sales/summary')->assertForbidden();
    }

    // --- paying by transfer ---------------------------------------------------

    public function test_promptpay_returns_a_payload_for_the_sale_total(): void
    {
        $water = $this->product(['price' => 15, 'stock_qty' => 10]);
        $token = $this->login();

        $saleId = $this->as($token)->postJson('/api/v1/owner/sales', [
            'items' => [['productId' => $water->id, 'quantity' => 2]],
            'paymentMethod' => 'transfer',
        ])->json('data.id');

        $body = $this->as($token)->getJson("/api/v1/owner/sales/{$saleId}/promptpay")
            ->assertOk()
            ->json();

        $this->assertSame(30.0, (float) $body['amount']);
        // EMVCo payloads start with the format indicator; anything else is not
        // a QR a banking app will read.
        $this->assertStringStartsWith('0002', $body['payload']);
    }

    /** Better a clear refusal than a QR that pays nobody. */
    public function test_promptpay_is_refused_when_the_venue_has_not_configured_one(): void
    {
        $this->org()->settings()->update(['promptpay_id' => null]);

        $water = $this->product(['stock_qty' => 5]);
        $token = $this->login();

        $saleId = $this->as($token)->postJson('/api/v1/owner/sales', [
            'items' => [['productId' => $water->id, 'quantity' => 1]],
            'paymentMethod' => 'transfer',
        ])->json('data.id');

        $this->as($token)->getJson("/api/v1/owner/sales/{$saleId}/promptpay")->assertStatus(422);
    }

    // --- the race that costs money -------------------------------------------

    /**
     * Two tills, one bottle left.
     *
     * Called through the service directly: an HTTP test cannot interleave two
     * requests, and the point is that the second attempt sees the first one's
     * decrement rather than a stale read.
     */
    public function test_two_sales_cannot_take_the_same_last_item(): void
    {
        $water = $this->product(['name' => 'ขวดสุดท้าย', 'stock_qty' => 1]);
        $pos = app(PosService::class);
        $org = $this->org();

        $pos->sell($org, [['productId' => $water->id, 'quantity' => 1]], 'cash');

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $pos->sell($org, [['productId' => $water->id, 'quantity' => 1]], 'cash');

        $this->assertSame(0, $water->fresh()->stock_qty);
    }
}
