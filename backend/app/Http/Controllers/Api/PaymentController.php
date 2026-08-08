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
    public function uploadSlip(Request $request, string $id): PaymentResource
    {
        $request->validate([
            'slip' => ['required', 'image', 'mimes:jpeg,jpg,png', 'max:5120'],
        ]);

        $payment = $this->findOwned($request, $id);

        $file = $request->file('slip');
        $path = $file->store('slips', 'public');
        $absoluteUrl = url(Storage::url($path));

        $payment->slips()->create([
            'file_path' => $path,
            'url' => $absoluteUrl,
            'original_name' => $file->getClientOriginalName(),
            'uploaded_at' => now(),
        ]);

        $payment->update([
            'slip_url' => $absoluteUrl,
            'status' => 'pending_review',
        ]);

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
