<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminInvoiceResource;
use App\Models\Invoice;
use App\Models\Organization;
use App\Models\PlatformSetting;
use App\Services\BillingDocumentService;
use App\Services\PromptPayService;
use App\Services\SubscriptionRenewalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;

/**
 * The venue's own billing: how long it has left, and how to pay for more.
 *
 * Reachable even when the subscription has lapsed — EnsureSubscriptionActive
 * exempts these routes, otherwise an expired venue could never renew.
 */
class BillingController extends Controller
{
    public function __construct(private SubscriptionRenewalService $renewals) {}

    /**
     * GET /owner/billing — subscription status + the invoice awaiting payment.
     */
    public function show(Request $request): JsonResponse
    {
        $org = $this->currentOrganization($request);
        $sub = $this->renewals->currentSubscription($org);
        $outstanding = $this->renewals->outstandingInvoice($org);

        return response()->json([
            'data' => [
                'subscription' => $sub ? [
                    'planName' => $sub->plan?->name,
                    'price' => $sub->plan ? (float) $sub->plan->price : null,
                    'interval' => $sub->plan?->interval,
                    'status' => $sub->status,
                    'startedAt' => $sub->started_at?->toIso8601String(),
                    'endsAt' => $sub->ends_at?->toIso8601String(),
                    'daysRemaining' => $this->renewals->daysRemaining($sub),
                    'isExpired' => $this->renewals->isExpired($sub),
                    // What the plan's ceilings are and how much is used. This is
                    // the page a venue lands on when it runs out of courts to
                    // add, so it is the page that has to explain why.
                    'limits' => \App\Support\PlanLimits::summary($sub->organization_id),
                ] : null,
                'outstandingInvoice' => $outstanding
                    ? (new AdminInvoiceResource($outstanding->loadMissing('plan')))->toArray($request)
                    : null,
                'payTo' => $this->payToBlock(),
            ],
        ]);
    }

    /** GET /owner/billing/invoices — this venue's billing history. */
    public function invoices(Request $request): AnonymousResourceCollection
    {
        $org = $this->currentOrganization($request);

        return AdminInvoiceResource::collection(
            Invoice::query()
                ->forOrganization($org->id)
                ->with('plan')
                ->orderByDesc('created_at')
                ->get(),
        );
    }

    /**
     * POST /owner/billing/renew { periodMonths } — raise the invoice to pay.
     *
     * Idempotent by design: while an invoice is still outstanding this returns
     * that same one instead of stacking a second, so the venue can reopen the
     * page without creating duplicates an admin would have to untangle.
     */
    public function renew(Request $request): JsonResponse
    {
        $data = $request->validate([
            'periodMonths' => ['required', 'integer', 'in:1,3,6,12'],
        ]);

        $org = $this->currentOrganization($request);
        $invoice = $this->renewals->raiseInvoice($org, (int) $data['periodMonths'], 'owner');

        return response()->json([
            'data' => (new AdminInvoiceResource($invoice->loadMissing('plan')))->toArray($request),
        ], 201);
    }

    /**
     * GET /owner/billing/invoices/{id}/instructions — where to send the money.
     * A real scannable PromptPay QR for the invoice amount, plus bank details.
     */
    public function instructions(Request $request, string $id, PromptPayService $promptpay): JsonResponse
    {
        $invoice = $this->findOwned($request, $id);
        $settings = PlatformSetting::query()->first();

        return response()->json([
            'amount' => (float) $invoice->amount,
            'payTo' => $this->payToBlock(),
            'promptpay' => filled($settings?->promptpay_id)
                ? ['payload' => $promptpay->payload($settings->promptpay_id, (float) $invoice->amount)]
                : null,
            'bank' => filled($settings?->bank_account_number) ? [
                'bankName' => $settings->bank_name,
                'accountName' => $settings->bank_account_name,
                'accountNumber' => $settings->bank_account_number,
            ] : null,
        ]);
    }

    /**
     * GET /owner/billing/invoices/{id}/document — the printable invoice or
     * receipt. Same payload the platform sees, so both read the same document.
     */
    public function document(Request $request, string $id, BillingDocumentService $docs): JsonResponse
    {
        $invoice = $this->findOwned($request, $id);

        return response()->json(['data' => $docs->build($invoice->loadMissing('plan'))]);
    }

    /**
     * GET /owner/billing/invoices/{id}/document.pdf — the same document as a
     * PDF, opened inline so it can be read in the browser and saved from there.
     */
    public function documentPdf(Request $request, string $id, BillingDocumentService $docs)
    {
        $invoice = $this->findOwned($request, $id)->loadMissing('plan');

        return $docs->pdf($invoice)->stream($docs->filename($invoice));
    }

    /**
     * POST /owner/billing/invoices/{id}/slip — submit the transfer slip.
     * Moves the invoice to pending_review; only an admin's approval extends
     * the subscription.
     */
    public function uploadSlip(Request $request, string $id): AdminInvoiceResource
    {
        $request->validate([
            'slip' => ['required', 'image', 'mimes:jpeg,jpg,png', 'max:5120'],
        ]);

        $invoice = $this->findOwned($request, $id);

        abort_if(! $invoice->isOutstanding(), 422, 'ใบแจ้งหนี้นี้ถูกดำเนินการไปแล้ว');

        $file = $request->file('slip');
        $path = $file->store('slips/'.$invoice->organization_id, 'public');

        $invoice->update([
            'slip_path' => $path,
            'slip_url' => url(Storage::url($path)),
            'slip_uploaded_at' => now(),
            'status' => 'pending_review',
            'reject_reason' => null,
        ]);

        return new AdminInvoiceResource($invoice->fresh()->loadMissing('plan'));
    }

    /** The platform's payee name, for the "transfer to" line. */
    private function payToBlock(): ?string
    {
        $settings = PlatformSetting::query()->first();

        return $settings?->promptpay_name ?: $settings?->bank_account_name ?: $settings?->platform_name;
    }

    /** An invoice must belong to the caller's own venue. */
    private function findOwned(Request $request, string $id): Invoice
    {
        $org = $this->currentOrganization($request);

        return Invoice::query()
            ->forOrganization($org->id)
            ->whereKey($id)
            ->firstOrFail();
    }

    private function currentOrganization(Request $request): Organization
    {
        return Organization::findOrFail($request->attributes->get('currentOrganizationId'));
    }
}
