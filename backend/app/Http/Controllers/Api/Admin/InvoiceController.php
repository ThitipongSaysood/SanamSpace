<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\PaginatesLists;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdminInvoiceResource;
use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Plan;
use App\Services\BillingDocumentService;
use App\Services\SubscriptionRenewalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Mail;

/**
 * Platform billing from the operator's side: bill a venue, and decide on the
 * transfer slips venues submit to renew.
 *
 * Everything that moves money or a subscription goes through
 * SubscriptionRenewalService so the Owner and Admin paths can never diverge.
 */
class InvoiceController extends Controller
{
    use PaginatesLists;

    public function __construct(private SubscriptionRenewalService $renewals) {}

    /**
     * GET /admin/invoices — every billing document.
     *
     * ?status=pending_review narrows it to the queue that needs a decision.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $invoices = Invoice::query()
            ->with('plan')
            ->when($request->query('status'), fn ($q, $s) => $q->where('status', $s))
            // Slips waiting on the platform come first — that is the actual work.
            ->orderByRaw("CASE WHEN status = 'pending_review' THEN 0 ELSE 1 END")
            ->orderByDesc('issue_date')
            ->orderByDesc('created_at');

        return AdminInvoiceResource::collection($this->paginated($invoices, $request));
    }

    /**
     * POST /admin/invoices { organizationId, periodMonths, planId? } — bill a
     * venue directly, for the venues that would rather be invoiced than renew
     * themselves. The venue then pays it through its own billing page.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'organizationId' => ['required', 'string', 'exists:organizations,id'],
            'periodMonths' => ['required', 'integer', 'in:1,3,6,12'],
            'planId' => ['sometimes', 'nullable', 'string', 'exists:plans,id'],
        ]);

        $org = Organization::findOrFail($data['organizationId']);
        $plan = isset($data['planId']) && $data['planId'] ? Plan::find($data['planId']) : null;

        $invoice = $this->renewals->raiseInvoice($org, (int) $data['periodMonths'], 'admin', $plan);

        return response()->json([
            'data' => (new AdminInvoiceResource($invoice->loadMissing('plan')))->toArray($request),
        ], 201);
    }

    /**
     * POST /admin/invoices/{id}/pay — accept payment for an invoice.
     *
     * This is the approval step for a submitted slip and the manual
     * "mark as paid" in one: either way the money is confirmed received, so it
     * extends the subscription and records a platform transaction. Once paid,
     * the document becomes a receipt (ใบเสร็จรับเงิน).
     */
    public function pay(Request $request, string $id): AdminInvoiceResource
    {
        $invoice = Invoice::findOrFail($id);
        $method = $request->input('method', $invoice->slip_url ? 'transfer' : 'manual');

        return new AdminInvoiceResource(
            $this->renewals->approve($invoice, $method)->loadMissing('plan'),
        );
    }

    /**
     * POST /admin/invoices/{id}/reject { reason } — turn down a slip.
     * The subscription is untouched and the venue can transfer again.
     */
    public function reject(Request $request, string $id): AdminInvoiceResource
    {
        $data = $request->validate([
            'reason' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        $invoice = Invoice::findOrFail($id);

        return new AdminInvoiceResource(
            $this->renewals->reject($invoice, $data['reason'] ?? null)->loadMissing('plan'),
        );
    }

    /**
     * GET /admin/invoices/{id}/document — the printable invoice or receipt.
     */
    public function document(string $id, BillingDocumentService $docs): JsonResponse
    {
        return response()->json([
            'data' => $docs->build(Invoice::with('plan')->findOrFail($id)),
        ]);
    }

    /** GET /admin/invoices/{id}/document.pdf — the document as a PDF. */
    public function documentPdf(string $id, BillingDocumentService $docs)
    {
        $invoice = Invoice::with('plan')->findOrFail($id);

        return $docs->pdf($invoice)->stream($docs->filename($invoice));
    }

    /**
     * POST /admin/invoices/{id}/send — email the document to the org.
     * Wording adapts: a paid invoice is sent as a receipt, otherwise as an invoice/reminder.
     */
    public function send(string $id): JsonResponse
    {
        $invoice = Invoice::findOrFail($id);
        $email = $this->contactEmailFor($invoice);

        if (! $email) {
            return response()->json(['sent' => false, 'message' => 'ไม่พบอีเมลของลูกค้า'], 422);
        }

        $isReceipt = $invoice->status === 'paid';
        $docName = $isReceipt ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้';
        $period = $invoice->period_months ? "ต่ออายุ {$invoice->period_months} เดือน\n" : '';

        // An unpaid invoice needs to say how to pay it — the QR and bank details
        // live on the venue's own billing page, which is also where the slip goes.
        $howToPay = $isReceipt
            ? "ชำระเมื่อ {$invoice->paid_date} · สถานะ: ชำระแล้ว\n"
            : "สถานะ: ค้างชำระ\n\n"
                ."ชำระเงินได้ที่หน้า “แพ็กเกจ/ต่ออายุ” ในระบบจัดการสนามของท่าน\n"
                ."(สแกน PromptPay หรือโอนเข้าบัญชี แล้วแนบสลิป — ระบบจะต่ออายุให้เมื่อตรวจสอบเรียบร้อย)\n";

        $body = "เรียน {$invoice->organization_name}\n\n"
            ."{$docName}เลขที่ {$invoice->number}\n"
            .$period
            ."ยอด ฿".number_format((float) $invoice->amount, 2)."\n"
            ."วันที่ออก {$invoice->issue_date} · ครบกำหนด {$invoice->due_date}\n"
            .$howToPay
            ."\nขอบคุณที่ใช้บริการ SanamSpace";

        try {
            Mail::raw($body, function ($m) use ($email, $invoice, $docName) {
                $m->to($email)->subject("{$docName} {$invoice->number} - SanamSpace");
            });
        } catch (\Throwable $e) {
            return response()->json(['sent' => false, 'message' => 'ส่งอีเมลไม่สำเร็จ'], 500);
        }

        return response()->json(['sent' => true, 'email' => $email, 'isReceipt' => $isReceipt]);
    }

    /**
     * Prefers the linked organization; falls back to matching by name for the
     * older rows that predate invoices carrying an organization_id.
     */
    private function contactEmailFor(Invoice $invoice): ?string
    {
        $org = $invoice->organization_id
            ? Organization::find($invoice->organization_id)
            : Organization::where('name', $invoice->organization_name)->first();

        return $org?->settings?->email;
    }
}
