<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Organization;
use App\Models\PlatformSetting;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Invoices and receipts as real documents.
 *
 * The rules that matter: a receipt number is issued once, when the money is
 * confirmed, and never again; and the tax split is frozen onto the invoice at
 * issue time so changing the rate later cannot rewrite a document that has
 * already gone out.
 *
 * Plan prices are VAT-INCLUSIVE — the seeded venue is on Pro at ฿3,990
 * whether or not VAT is on.
 */
class BillingDocumentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    /**
     * Laravel keeps the resolved guard user between calls in one test, so a
     * second withToken() alone would stay authenticated as the first user.
     */
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

    private function enableVat(float $rate = 7): void
    {
        PlatformSetting::query()->firstOrCreate([])->update([
            'vat_enabled' => true,
            'vat_rate' => $rate,
            'company_name' => 'บริษัท สนามสเปซ จำกัด',
            'tax_id' => '0105564000000',
            'company_address' => '99/9 ถนนสุขุมวิท กรุงเทพฯ 10110',
        ]);
    }

    private function raise(string $token, int $months = 1): string
    {
        return $this->as($token)
            ->postJson('/api/v1/owner/billing/renew', ['periodMonths' => $months])
            ->assertCreated()
            ->json('data.id');
    }

    // --- Tax split ------------------------------------------------------------

    /** VAT off: the whole price is the net amount, and no tax line exists. */
    public function test_without_vat_the_total_is_untaxed(): void
    {
        $id = $this->raise($this->ownerToken());

        $this->as($this->ownerToken())->getJson("/api/v1/owner/billing/invoices/{$id}/document")
            ->assertOk()
            ->assertJsonPath('data.title', 'ใบแจ้งหนี้')
            ->assertJsonPath('data.subtotal', 3990)
            ->assertJsonPath('data.vatAmount', 0)
            ->assertJsonPath('data.vatRate', 0)
            ->assertJsonPath('data.total', 3990);
    }

    /** VAT on: the tax is backed OUT of the price, never added on top. */
    public function test_vat_is_backed_out_of_a_vat_inclusive_price(): void
    {
        $this->enableVat();
        $id = $this->raise($this->ownerToken());

        $doc = $this->as($this->ownerToken())
            ->getJson("/api/v1/owner/billing/invoices/{$id}/document")
            ->assertOk()
            ->assertJsonPath('data.title', 'ใบแจ้งหนี้/ใบกำกับภาษี')
            ->assertJsonPath('data.total', 3990)          // the venue still pays 3,990
            ->assertJsonPath('data.subtotal', 3728.97)    // 3,990 / 1.07
            ->assertJsonPath('data.vatAmount', 261.03)
            ->assertJsonPath('data.vatRate', 7);

        // The parts must always add back to what was charged.
        $this->assertSame(
            round($doc->json('data.subtotal') + $doc->json('data.vatAmount'), 2),
            round($doc->json('data.total'), 2),
        );
    }

    /** Changing the rate must not rewrite a document already issued. */
    public function test_changing_the_rate_leaves_issued_invoices_alone(): void
    {
        $this->enableVat(7);
        $id = $this->raise($this->ownerToken());

        PlatformSetting::query()->first()->update(['vat_rate' => 10]);

        $this->as($this->ownerToken())->getJson("/api/v1/owner/billing/invoices/{$id}/document")
            ->assertOk()
            ->assertJsonPath('data.vatRate', 7)
            ->assertJsonPath('data.vatAmount', 261.03);
    }

    // --- Receipts -------------------------------------------------------------

    public function test_an_unpaid_invoice_has_no_receipt_number(): void
    {
        $id = $this->raise($this->ownerToken());

        $this->assertNull(Invoice::findOrFail($id)->receipt_number);
    }

    /** Approval issues the receipt: its own series, and the invoice as reference. */
    public function test_approval_issues_a_receipt_document(): void
    {
        $this->enableVat();
        $admin = $this->adminToken();
        $id = $this->raise($this->ownerToken());

        $this->as($admin)->postJson("/api/v1/admin/invoices/{$id}/pay")->assertOk();

        $invoice = Invoice::findOrFail($id);
        $this->assertMatchesRegularExpression('/^RCP-\d{4}-\d{4}$/', $invoice->receipt_number);
        $this->assertNotNull($invoice->receipt_date);

        $this->as($admin)->getJson("/api/v1/admin/invoices/{$id}/document")
            ->assertOk()
            ->assertJsonPath('data.kind', 'receipt')
            ->assertJsonPath('data.title', 'ใบเสร็จรับเงิน/ใบกำกับภาษี')
            ->assertJsonPath('data.number', $invoice->receipt_number)
            ->assertJsonPath('data.reference', $invoice->number)
            ->assertJsonPath('data.seller.taxId', '0105564000000');
    }

    /** Invoice and receipt numbers run separate sequences. */
    public function test_receipt_numbers_are_their_own_series(): void
    {
        $admin = $this->adminToken();
        $owner = $this->ownerToken();

        $first = $this->raise($owner);
        $this->as($admin)->postJson("/api/v1/admin/invoices/{$first}/pay")->assertOk();
        $second = $this->raise($owner);
        $this->as($admin)->postJson("/api/v1/admin/invoices/{$second}/pay")->assertOk();

        $numbers = Invoice::whereIn('id', [$first, $second])->pluck('receipt_number')->sort()->values();
        $year = now()->year;
        $this->assertSame(["RCP-{$year}-0001", "RCP-{$year}-0002"], $numbers->all());

        // …and the receipt series did not consume invoice numbers.
        $this->assertNotNull(Invoice::find($first)->number);
        $this->assertStringStartsWith('INV-', Invoice::find($first)->number);
    }

    /** A rejected slip must not leave a receipt behind. */
    public function test_rejection_issues_no_receipt(): void
    {
        $admin = $this->adminToken();
        $id = $this->raise($this->ownerToken());

        $this->as($admin)->postJson("/api/v1/admin/invoices/{$id}/reject", ['reason' => 'ยอดไม่ตรง'])
            ->assertOk();

        $this->assertNull(Invoice::findOrFail($id)->receipt_number);
    }

    // --- Who is on the document ----------------------------------------------

    public function test_the_buyer_block_uses_the_venues_billing_identity(): void
    {
        $org = Organization::where('slug', 'everyday-badminton')->firstOrFail();
        $owner = $this->ownerToken();

        $this->as($owner)->putJson('/api/v1/owner/settings', [
            'billingName' => 'บริษัท เอฟเวอรี่เดย์ จำกัด',
            'taxId' => '0105562111111',
            'billingAddress' => '1 ถนนทดสอบ',
            'billingBranch' => 'สำนักงานใหญ่',
        ])->assertOk();

        $id = $this->raise($owner);

        $this->as($owner)->getJson("/api/v1/owner/billing/invoices/{$id}/document")
            ->assertOk()
            ->assertJsonPath('data.buyer.name', 'บริษัท เอฟเวอรี่เดย์ จำกัด')
            ->assertJsonPath('data.buyer.taxId', '0105562111111')
            ->assertJsonPath('data.buyer.branch', 'สำนักงานใหญ่');

        $this->assertSame($org->id, Invoice::findOrFail($id)->organization_id);
    }

    /** Falls back to the venue's own name when no billing identity is set. */
    public function test_the_buyer_block_falls_back_to_the_venue_name(): void
    {
        $id = $this->raise($this->ownerToken());

        $this->as($this->ownerToken())->getJson("/api/v1/owner/billing/invoices/{$id}/document")
            ->assertOk()
            ->assertJsonPath('data.buyer.name', 'Everyday Badminton');
    }

    // --- PDF ------------------------------------------------------------------

    /**
     * The PDF must carry an embedded Thai font.
     *
     * dompdf ships only the core PDF fonts, none of which have Thai glyphs — if
     * registration ever breaks it falls back to Helvetica silently and every
     * invoice prints as a page of empty boxes. Nothing else would catch that.
     */
    public function test_the_pdf_embeds_a_thai_font(): void
    {
        $this->enableVat();
        $admin = $this->adminToken();
        $id = $this->raise($this->ownerToken());
        $this->as($admin)->postJson("/api/v1/admin/invoices/{$id}/pay")->assertOk();

        $res = $this->as($admin)->get("/api/v1/admin/invoices/{$id}/document.pdf");
        $res->assertOk();
        $this->assertStringContainsString('application/pdf', $res->headers->get('content-type'));

        $pdf = $res->getContent();
        $this->assertStringStartsWith('%PDF', $pdf);
        $this->assertStringContainsString('Sarabun', $pdf);
        $this->assertStringNotContainsString('/BaseFont /Helvetica', $pdf);
    }

    /** The filename is the document number, ready to file. */
    public function test_the_pdf_is_named_after_the_document(): void
    {
        $id = $this->raise($this->ownerToken());

        $this->as($this->ownerToken())
            ->get("/api/v1/owner/billing/invoices/{$id}/document.pdf")
            ->assertOk()
            ->assertHeader(
                'content-disposition',
                'inline; filename='.Invoice::findOrFail($id)->number.'.pdf',
            );
    }

    /** A venue must not be able to pull another venue's PDF either. */
    public function test_a_venue_cannot_open_another_venues_pdf(): void
    {
        $tsr = Organization::where('slug', 'tsr-arena')->firstOrFail();
        $foreign = Invoice::create([
            'number' => 'INV-TEST-8888',
            'organization_id' => $tsr->id,
            'organization_name' => $tsr->name,
            'amount' => 1990,
            'status' => 'unpaid',
            'issue_date' => now()->format('Y-m-d'),
            'due_date' => now()->addDays(7)->format('Y-m-d'),
        ]);

        $this->as($this->ownerToken())
            ->get("/api/v1/owner/billing/invoices/{$foreign->id}/document.pdf")
            ->assertNotFound();
    }

    // --- Access ---------------------------------------------------------------

    public function test_a_venue_cannot_open_another_venues_document(): void
    {
        $tsr = Organization::where('slug', 'tsr-arena')->firstOrFail();
        $foreign = Invoice::create([
            'number' => 'INV-TEST-9999',
            'organization_id' => $tsr->id,
            'organization_name' => $tsr->name,
            'amount' => 1990,
            'status' => 'unpaid',
            'issue_date' => now()->format('Y-m-d'),
            'due_date' => now()->addDays(7)->format('Y-m-d'),
        ]);

        $this->as($this->ownerToken())
            ->getJson("/api/v1/owner/billing/invoices/{$foreign->id}/document")
            ->assertNotFound();
    }
}
