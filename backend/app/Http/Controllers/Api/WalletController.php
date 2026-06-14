<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\WalletResource;
use App\Models\OrganizationSetting;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Services\PromptPayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class WalletController extends Controller
{
    private const THAI_MONTHS = [
        1 => 'ม.ค.', 2 => 'ก.พ.', 3 => 'มี.ค.', 4 => 'เม.ย.', 5 => 'พ.ค.', 6 => 'มิ.ย.',
        7 => 'ก.ค.', 8 => 'ส.ค.', 9 => 'ก.ย.', 10 => 'ต.ค.', 11 => 'พ.ย.', 12 => 'ธ.ค.',
    ];

    /**
     * GET /wallet -> Wallet (current authenticated customer, with txns).
     */
    public function show(Request $request): WalletResource
    {
        $wallet = Wallet::query()
            ->with(['transactions' => fn ($q) => $q->orderBy('sort_order')])
            ->where('customer_id', $request->user()->id)
            ->firstOrFail();

        return new WalletResource($wallet);
    }

    /**
     * POST /wallet/topup { amount } — request a top-up. Creates a PENDING
     * transaction (balance unchanged until the venue approves the slip) and
     * returns a real PromptPay QR + the venue's bank details to pay into.
     */
    public function topup(Request $request, PromptPayService $promptpay): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0', 'max:100000'],
        ]);

        $wallet = Wallet::query()->where('customer_id', $request->user()->id)->firstOrFail();

        $nextSort = (int) WalletTransaction::query()->where('wallet_id', $wallet->id)->max('sort_order') + 1;

        $txn = WalletTransaction::create([
            'wallet_id' => $wallet->id,
            'txn_date' => $this->thaiShortDate(),
            'label' => 'เติมเงิน',
            'amount' => $data['amount'],
            'status' => 'pending',
            'sort_order' => $nextSort,
        ]);

        $setting = OrganizationSetting::query()->where('organization_id', $wallet->organization_id)->first();
        $promptpayBlock = filled($setting?->promptpay_id)
            ? ['payload' => $promptpay->payload($setting->promptpay_id, (float) $data['amount'])]
            : null;
        $bankBlock = filled($setting?->bank_account_number)
            ? ['bankName' => $setting->bank_name, 'accountName' => $setting->bank_account_name, 'accountNumber' => $setting->bank_account_number]
            : null;

        return response()->json([
            'transactionId' => (string) $txn->id,
            'amount' => (float) $data['amount'],
            'promptpay' => $promptpayBlock,
            'bank' => $bankBlock,
        ]);
    }

    /**
     * POST /wallet/topup/{id}/slip (multipart `slip`) — attach the transfer slip
     * to a pending top-up; moves it to pending_review for the venue to approve.
     */
    public function topupSlip(Request $request, string $id): WalletResource
    {
        $request->validate([
            'slip' => ['required', 'image', 'mimes:jpeg,jpg,png', 'max:5120'],
        ]);

        $wallet = Wallet::query()->where('customer_id', $request->user()->id)->firstOrFail();

        $txn = WalletTransaction::query()
            ->where('id', $id)
            ->where('wallet_id', $wallet->id)
            ->firstOrFail();

        $path = $request->file('slip')->store('slips', 'public');

        $txn->update([
            'slip_url' => url(Storage::url($path)),
            'status' => 'pending_review',
        ]);

        return new WalletResource($wallet->fresh()->load(['transactions' => fn ($q) => $q->orderBy('sort_order')]));
    }

    private function thaiShortDate(): string
    {
        $now = now();

        return $now->day.' '.(self::THAI_MONTHS[$now->month] ?? (string) $now->month);
    }
}
