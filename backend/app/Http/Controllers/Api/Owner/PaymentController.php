<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Api\Concerns\PaginatesLists;
use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerPaymentResource;
use App\Models\Payment;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PaymentController extends Controller
{
    use PaginatesLists;

    /**
     * GET /owner/payments?status=pending_review
     *
     * Org-scoped payments (newest first), optionally filtered by status.
     * Each item carries a booking summary + customerName via OwnerPaymentResource.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $payments = Payment::query()
            ->forOrganization($orgId)
            ->with(['booking.court', 'customer'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByDesc('created_at');

        return OwnerPaymentResource::collection($this->paginated($payments, $request));
    }

    /**
     * POST /owner/payments/{id}/verify — approve slip + confirm its booking.
     * Org-scoped: 404 if the payment belongs to another org.
     */
    public function verify(Request $request, string $id, NotificationService $notifications): OwnerPaymentResource
    {
        $payment = $this->findScoped($request, $id);

        $payment->update(['status' => 'approved']);
        $payment->booking?->update(['status' => 'confirmed']);

        $notifications->paymentApproved($payment);

        return new OwnerPaymentResource($payment->fresh(['booking.court', 'customer']));
    }

    /**
     * POST /owner/payments/{id}/reject — reject slip. Org-scoped.
     */
    public function reject(Request $request, string $id, NotificationService $notifications): OwnerPaymentResource
    {
        $payment = $this->findScoped($request, $id);
        $payment->update(['status' => 'rejected']);

        $notifications->paymentRejected($payment);

        return new OwnerPaymentResource($payment->fresh(['booking.court', 'customer']));
    }

    /**
     * Fetch a payment within the current org or abort (404).
     */
    private function findScoped(Request $request, string $id): Payment
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        return Payment::query()
            ->forOrganization($orgId)
            ->where('id', $id)
            ->firstOrFail();
    }
}
