<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerWalletResource;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class WalletController extends Controller
{
    /** Thai abbreviated month names, indexed 1..12 (matches seeded txn_date). */
    private const THAI_MONTHS = [
        1 => 'ม.ค.', 2 => 'ก.พ.', 3 => 'มี.ค.', 4 => 'เม.ย.', 5 => 'พ.ค.', 6 => 'มิ.ย.',
        7 => 'ก.ค.', 8 => 'ส.ค.', 9 => 'ก.ย.', 10 => 'ต.ค.', 11 => 'พ.ย.', 12 => 'ธ.ค.',
    ];

    /**
     * GET /owner/wallets — org wallets joined to their customer, with a
     * per-wallet transaction count.
     * Each item: { id, customerName, balance, transactionCount }
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $wallets = Wallet::query()
            ->forOrganization($orgId)
            ->with('customer')
            ->withCount('transactions')
            ->orderByDesc('balance')
            ->get();

        return OwnerWalletResource::collection($wallets);
    }

    /**
     * POST /owner/wallets/{id}/topup — credit a wallet by `amount` (> 0) and
     * record a +amount wallet_transactions row (label defaults to an admin
     * top-up label, txn_date = today as a Thai short date). Org-scoped (404
     * cross-org). Returns the updated wallet with its new transactionCount.
     */
    public function topup(Request $request, string $id): OwnerWalletResource
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'label' => ['nullable', 'string', 'max:255'],
        ]);

        $wallet = Wallet::query()
            ->forOrganization($orgId)
            ->where('id', $id)
            ->firstOrFail();

        $wallet->increment('balance', $validated['amount']);

        $nextSort = (int) WalletTransaction::query()
            ->where('wallet_id', $wallet->id)
            ->max('sort_order') + 1;

        WalletTransaction::create([
            'wallet_id' => $wallet->id,
            'txn_date' => $this->thaiShortDate(),
            'label' => $validated['label'] ?? 'เติมเงินโดยแอดมิน',
            'amount' => $validated['amount'],
            'sort_order' => $nextSort,
        ]);

        $wallet->loadCount('transactions');

        return new OwnerWalletResource($wallet->fresh()->load('customer')->loadCount('transactions'));
    }

    /** Today as a Thai abbreviated date, e.g. "13 มิ.ย." (matches seeded txn_date). */
    private function thaiShortDate(): string
    {
        $now = now();

        return $now->day.' '.(self::THAI_MONTHS[$now->month] ?? (string) $now->month);
    }

    /**
     * GET /owner/wallet-topups — customer-initiated top-ups awaiting approval
     * (status pending_review), org-scoped. Each: { id, customerName, amount, slipUrl, date }.
     */
    public function topupRequests(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $rows = WalletTransaction::query()
            ->where('status', 'pending_review')
            ->whereHas('wallet', fn ($q) => $q->forOrganization($orgId))
            ->with('wallet.customer')
            ->orderBy('created_at')
            ->get()
            ->map(fn ($txn) => [
                'id' => (string) $txn->id,
                'customerId' => $txn->wallet?->customer?->id,
                'customerName' => $txn->wallet?->customer?->display_name,
                'amount' => (float) $txn->amount,
                'slipUrl' => $txn->slip_url,
                'date' => $txn->txn_date,
            ]);

        return response()->json(['data' => $rows]);
    }

    /** POST /owner/wallet-topups/{id}/approve — credit the wallet and post the txn. */
    public function approveTopup(Request $request, string $id, NotificationService $notifications): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        // The status flip + the balance credit must be one atomic unit, and two
        // staff approving the same slip at once must not both credit it. Re-read
        // the row FOR UPDATE inside the transaction and re-assert it is still
        // pending: the second approval finds it already `completed` and 404s
        // rather than crediting a second time.
        $txn = DB::transaction(function () use ($id, $orgId) {
            $txn = WalletTransaction::query()
                ->where('id', $id)
                ->where('status', 'pending_review')
                ->whereHas('wallet', fn ($q) => $q->forOrganization($orgId))
                ->with('wallet')
                ->lockForUpdate()
                ->first();

            if (! $txn) {
                abort(404);
            }

            $txn->update(['status' => 'completed']);
            Wallet::whereKey($txn->wallet_id)->lockForUpdate()->first()?->increment('balance', $txn->amount);

            return $txn;
        });

        $notifications->topupApproved($txn);

        return response()->json(['id' => (string) $txn->id, 'status' => 'completed']);
    }

    /** POST /owner/wallet-topups/{id}/reject — decline the top-up (no credit). */
    public function rejectTopup(Request $request, string $id, NotificationService $notifications): JsonResponse
    {
        $txn = $this->findPendingTopup($request, $id);
        $txn->update(['status' => 'rejected']);

        $notifications->topupRejected($txn);

        return response()->json(['id' => (string) $txn->id, 'status' => 'rejected']);
    }

    private function findPendingTopup(Request $request, string $id): WalletTransaction
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        return WalletTransaction::query()
            ->where('id', $id)
            ->where('status', 'pending_review')
            ->whereHas('wallet', fn ($q) => $q->forOrganization($orgId))
            ->with('wallet')
            ->firstOrFail();
    }
}
