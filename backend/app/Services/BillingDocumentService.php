<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Organization;
use App\Models\PlatformSetting;
use Barryvdh\DomPDF\Facade\Pdf;

/**
 * Assembles a printable billing document from an invoice.
 *
 * One shape serves both portals so the venue and the platform are always
 * looking at the identical document — a receipt that differs depending on who
 * opened it is worse than no receipt at all.
 *
 * Which document it is follows the money: unpaid → ใบแจ้งหนี้, paid → ใบเสร็จ
 * รับเงิน (and ใบกำกับภาษี too, when the platform charges VAT).
 */
class BillingDocumentService
{
    public function build(Invoice $invoice): array
    {
        $settings = PlatformSetting::query()->first();
        $paid = $invoice->status === 'paid';
        $taxed = (float) $invoice->vat_rate > 0;

        return [
            'kind' => $paid ? 'receipt' : 'invoice',
            'title' => $this->title($paid, $taxed),
            'titleEn' => $paid ? 'RECEIPT' : 'INVOICE',
            // A paid document is identified by its receipt number; the invoice
            // number stays visible as the reference it settles.
            'number' => $paid ? ($invoice->receipt_number ?: $invoice->number) : $invoice->number,
            'reference' => $paid ? $invoice->number : null,
            'issueDate' => $paid ? ($invoice->receipt_date ?: $invoice->paid_date) : $invoice->issue_date,
            'dueDate' => $invoice->due_date,
            'paidDate' => $invoice->paid_date,
            'status' => $invoice->status,

            'seller' => [
                'name' => $settings?->company_name ?: $settings?->platform_name ?: 'SanamSpace',
                'taxId' => $settings?->tax_id,
                'address' => $settings?->company_address,
                'email' => $settings?->support_email,
            ],
            'buyer' => $this->buyer($invoice),

            'lines' => [[
                'description' => $this->lineDescription($invoice),
                'amount' => (float) $invoice->amount,
            ]],

            'subtotal' => (float) ($invoice->subtotal ?: $invoice->amount),
            'vatRate' => (float) $invoice->vat_rate,
            'vatAmount' => (float) $invoice->vat_amount,
            'total' => (float) $invoice->amount,
            // Prices are quoted VAT-inclusive, so the document says so rather
            // than leaving the reader to work out why net + vat = the price.
            'vatInclusive' => $taxed,
        ];
    }

    /**
     * The same document as a PDF.
     *
     * Rendered server-side rather than from the browser's print dialog: this is
     * the copy that gets filed and forwarded, so it must look identical no
     * matter who opened it or which browser they used.
     */
    public function pdf(Invoice $invoice)
    {
        $doc = $this->build($invoice);

        return Pdf::loadView('billing.document', [
            'doc' => $doc,
            'money' => fn (float $n) => '฿'.number_format($n, 2),
        ])->setPaper('a4');
    }

    /** Filename a venue can drop straight into its own records. */
    public function filename(Invoice $invoice): string
    {
        $doc = $this->build($invoice);

        return $doc['number'].'.pdf';
    }

    private function title(bool $paid, bool $taxed): string
    {
        if (! $paid) {
            return $taxed ? 'ใบแจ้งหนี้/ใบกำกับภาษี' : 'ใบแจ้งหนี้';
        }

        return $taxed ? 'ใบเสร็จรับเงิน/ใบกำกับภาษี' : 'ใบเสร็จรับเงิน';
    }

    /**
     * The venue's billing identity, falling back to its everyday details when
     * it has not filled in separate billing ones.
     */
    private function buyer(Invoice $invoice): array
    {
        $org = $invoice->organization_id
            ? Organization::with('settings')->find($invoice->organization_id)
            : null;
        $s = $org?->settings;

        return [
            'name' => $s?->billing_name ?: $org?->name ?: $invoice->organization_name,
            'taxId' => $s?->tax_id,
            'address' => $s?->billing_address ?: $s?->address,
            'branch' => $s?->billing_branch,
            'phone' => $s?->phone,
        ];
    }

    private function lineDescription(Invoice $invoice): string
    {
        $plan = $invoice->plan?->name;
        $months = (int) ($invoice->period_months ?: 1);
        $period = $months === 12 ? '1 ปี' : "{$months} เดือน";

        return $plan
            ? "ค่าบริการระบบ SanamSpace แพ็กเกจ {$plan} ({$period})"
            : "ค่าบริการระบบ SanamSpace ({$period})";
    }
}
