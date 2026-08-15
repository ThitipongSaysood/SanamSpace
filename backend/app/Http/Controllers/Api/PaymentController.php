<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentResource;
use App\Models\Booking;
use App\Models\Organization;
use App\Models\OrganizationSetting;
use App\Models\Payment;
use App\Services\PromptPayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class PaymentController extends Controller
{
    public function __construct(private \App\Services\DepositService $deposits) {}

    /**
     * POST /payments { bookingId, method } -> Payment (status awaiting_slip).
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'bookingId' => ['required', 'string'],
            'method' => ['required', 'string', 'in:promptpay,transfer,wallet,card'],
        ]);

        $customer = $request->user();

        // Booking must belong to the current customer.
        $booking = Booking::query()
            ->where('id', $data['bookingId'])
            ->where('customer_id', $customer->id)
            ->first();

        if (! $booking) {
            throw ValidationException::withMessages([
                'bookingId' => 'ไม่พบรายการจองนี้',
            ]);
        }

        if ($booking->status === 'cancelled') {
            throw ValidationException::withMessages([
                'bookingId' => 'การจองนี้ถูกยกเลิกแล้ว',
            ]);
        }

        // With deposits, "confirmed" no longer means "paid in full" — the slot
        // is held once the deposit lands and a balance can still be owed. So the
        // question is whether money is outstanding, not what the status says.
        $outstanding = $this->deposits->outstanding($booking);

        if ($outstanding <= 0) {
            throw ValidationException::withMessages([
                'bookingId' => 'การจองนี้ชำระเงินเรียบร้อยแล้ว',
            ]);
        }

        $due = $this->deposits->nextPaymentAmount($booking);

        // Reuse the payment already in flight instead of opening a second one.
        // Tapping "ไปชำระเงิน" again used to create a duplicate row, so the
        // venue saw two payments — and two slips — for one booking.
        $existing = $booking->payments()
            ->whereIn('status', ['awaiting_slip', 'pending_review'])
            ->latest()
            ->first();

        if ($existing) {
            // Still choosing how to pay: honour the new choice rather than
            // stranding them on the method they first tapped.
            if ($existing->status === 'awaiting_slip' && $existing->method !== $data['method']) {
                $existing->update(['method' => $data['method'], 'amount' => $due]);
            }

            return (new PaymentResource($existing->fresh()))
                ->response()
                ->setStatusCode(200);
        }

        $payment = Payment::create([
            'organization_id' => $booking->organization_id,
            'booking_id' => $booking->id,
            'customer_id' => $customer->id,
            'method' => $data['method'],
            // The deposit first, the balance after — asking for the full amount
            // up front would make the venue's deposit setting decorative.
            'amount' => $due,
            'status' => 'awaiting_slip',
        ]);

        return (new PaymentResource($payment))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * POST /payments/{id}/upload-slip (multipart field `slip`) -> Payment.
     * Stores the slip on the public disk, records it, and moves the payment
     * to pending_review with an absolute slipUrl.
     */
    public function uploadSlip(Request $request, string $id, \App\Services\SlipVerificationService $slips): PaymentResource
    {
        // transRef / qrPayload are optional — the app decodes the slip's QR when
        // it can and sends them so a re-saved image is still caught as a reuse.
        $data = $request->validate([
            'slip' => ['required', 'image', 'mimes:jpeg,jpg,png', 'max:5120'],
            'transRef' => ['sometimes', 'nullable', 'string', 'max:120'],
            'qrPayload' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);

        $payment = $this->findOwned($request, $id);

        // A slip is only accepted while one is actually wanted.
        //
        // There was no check at all, and the two ways to arrive here again are
        // ordinary: a second tab left open from before the first slip was sent,
        // and the browser's Back button. Sending another slip on a payment that
        // is already waiting doubles the venue's review work and makes a
        // mistaken second transfer look routine — and on one the venue has
        // ALREADY APPROVED it dragged a settled payment back to
        // `pending_review`, undoing the venue's own decision.
        //
        // `rejected` is deliberately still open: the venue asking for a better
        // photo is exactly when a customer needs to send one.
        if (! in_array($payment->status, ['awaiting_slip', 'rejected'], true)) {
            throw ValidationException::withMessages([
                'slip' => $payment->status === 'approved'
                    ? 'การชำระเงินนี้ได้รับการยืนยันแล้ว ไม่ต้องส่งสลิปอีก'
                    : 'ส่งสลิปไปแล้ว กำลังรอร้านตรวจสอบ',
            ]);
        }

        $file = $request->file('slip');
        $sha256 = hash_file('sha256', $file->getRealPath());
        $path = $file->store('slips/'.$payment->organization_id, 'public');
        $absoluteUrl = url(Storage::url($path));

        // A slip's QR payload is unique per transfer; hash it into a compact ref
        // so a re-saved image (new file hash) is still caught as a reuse.
        $qrPayload = $data['qrPayload'] ?? null;
        $transRef = $data['transRef'] ?? (filled($qrPayload) ? sha1($qrPayload) : null);

        $slip = $payment->slips()->create([
            'organization_id' => $payment->organization_id,
            'file_path' => $path,
            'url' => $absoluteUrl,
            'original_name' => $file->getClientOriginalName(),
            'uploaded_at' => now(),
            'sha256' => $sha256,
            'qr_payload' => $qrPayload,
            'trans_ref' => $transRef,
        ]);

        $payment->update([
            'slip_url' => $absoluteUrl,
            'status' => 'pending_review',
        ]);

        // Screen for a re-used slip, then auto-approve if the venue is in auto
        // mode and the slip passes verification (otherwise it waits in the queue).
        $slips->process($slip);

        return new PaymentResource($payment->fresh());
    }

    /**
     * GET /payments/{id} -> Payment (must belong to the current customer).
     */
    public function show(Request $request, string $id): PaymentResource
    {
        return new PaymentResource($this->findOwned($request, $id));
    }

    /**
     * GET /payments/{id}/instructions -> how to pay THIS payment, for THIS venue.
     * Returns a real scannable PromptPay payload (when the venue has a PromptPay
     * id and the method is promptpay) and/or the venue's bank-transfer details.
     */
    public function instructions(Request $request, string $id, PromptPayService $promptpay): JsonResponse
    {
        $payment = $this->findOwned($request, $id);

        $setting = OrganizationSetting::query()
            ->where('organization_id', $payment->organization_id)
            ->first();
        $payTo = $setting?->promptpay_name
            ?: Organization::query()->whereKey($payment->organization_id)->value('name');

        $promptpayBlock = null;
        if ($payment->method === 'promptpay' && filled($setting?->promptpay_id)) {
            $promptpayBlock = [
                'payload' => $promptpay->payload($setting->promptpay_id, (float) $payment->amount),
            ];
        }

        $bankBlock = null;
        if (filled($setting?->bank_account_number)) {
            $bankBlock = [
                'bankName' => $setting->bank_name,
                'accountName' => $setting->bank_account_name,
                'accountNumber' => $setting->bank_account_number,
            ];
        }

        return response()->json([
            'amount' => (float) $payment->amount,
            'method' => $payment->method,
            'payTo' => $payTo,
            'promptpay' => $promptpayBlock,
            'bank' => $bankBlock,
        ]);
    }

    /**
     * Fetch a payment owned by the current customer or abort (404).
     */
    private function findOwned(Request $request, string $id): Payment
    {
        return Payment::query()
            ->where('id', $id)
            ->where('customer_id', $request->user()->id)
            ->firstOrFail();
    }
}
