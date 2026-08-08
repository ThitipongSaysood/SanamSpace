<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Api\Concerns\PaginatesLists;
use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerPaymentResource;
use App\Models\Payment;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;

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
            // A slip for a booking that no longer stands is not work: approving
            // it would confirm a cancelled slot. Cancel/delete now closes the
            // payment too, but rows predating that are still in the queue.
            ->when(
                $request->string('status')->value() === 'pending_review',
                fn ($q) => $q->whereDoesntHave('booking', fn ($b) => $b->where('status', 'cancelled'))
                    ->where(fn ($b) => $b->whereNull('booking_id')->orWhereHas('booking'))
            )
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

        $this->assertOpen($payment);

        $booking = $payment->booking;

        // Approving money against a cancelled slot would silently un-cancel it
        // and put the court back on someone's calendar. The way out of a
        // cancelled booking with money attached is a refund, not a confirm.
        if ($booking?->status === 'cancelled') {
            throw ValidationException::withMessages([
                'id' => 'การจองนี้ถูกยกเลิกแล้ว — ถ้าลูกค้าโอนมาจริงให้ทำเรื่องคืนเงินแทน',
            ]);
        }

        $payment->update(['status' => 'approved']);

        // A booking already played out stays completed; confirming it again
        // would walk its status backwards.
        if ($booking && $booking->status !== 'completed') {
            $booking->update(['status' => 'confirmed']);
        }

        $notifications->paymentApproved($payment);

        return new OwnerPaymentResource($payment->fresh(['booking.court', 'customer']));
    }

    /**
     * POST /owner/payments/{id}/reject — reject slip. Org-scoped.
     */
    public function reject(Request $request, string $id, NotificationService $notifications): OwnerPaymentResource
    {
        $payment = $this->findScoped($request, $id);

        $this->assertOpen($payment);

        $payment->update(['status' => 'rejected']);

        $notifications->paymentRejected($payment);

        return new OwnerPaymentResource($payment->fresh(['booking.court', 'customer']));
    }

    /**
     * A slip can only be decided once.
     *
     * Two people working the queue on two phones both tap อนุมัติ on the same
     * row; without this the second tap re-approves and fires a second "payment
     * received" message to the customer.
     */
    private function assertOpen(Payment $payment): void
    {
        if ($payment->status === 'pending_review') {
            return;
        }

        $said = match ($payment->status) {
            'approved' => 'รายการนี้อนุมัติไปแล้ว',
            'rejected' => 'รายการนี้ถูกปฏิเสธไปแล้ว',
            'cancelled' => 'การจองของรายการนี้ถูกยกเลิกแล้ว',
            default => 'รายการนี้ยังไม่ได้แนบสลิป',
        };

        throw ValidationException::withMessages(['id' => $said]);
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
