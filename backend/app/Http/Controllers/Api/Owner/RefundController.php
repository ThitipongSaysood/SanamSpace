<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\Refund;
use App\Services\RefundService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Owner-side refund review. Customers create refunds (`requested`); the venue
 * staff approve (crediting the customer's wallet, or recording a manual/
 * off-system refund) or reject them. All money + state transitions go through
 * the shared RefundService so the wallet credit lives in exactly one place.
 *
 * Every action is org-scoped to the authed staff user's org (set by the
 * owner.org middleware); a refund from another org is invisible (404).
 */
class RefundController extends Controller
{
    /**
     * GET /owner/refunds — the org's refunds, `requested` first then newest,
     * each shaped as the frontend OwnerRefund.
     */
    public function index(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $refunds = Refund::query()
            ->forOrganization($orgId)
            ->with(['booking:id,code', 'customer:id,display_name'])
            // requested (pending) at the top, then most recent first.
            ->orderByRaw("CASE WHEN status = 'requested' THEN 0 ELSE 1 END")
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $refunds->map(fn (Refund $refund) => $this->present($refund))->all(),
        ]);
    }

    /**
     * POST /owner/refunds/{id}/approve — approve a requested refund. With
     * method=wallet (default) the customer's wallet is credited; method=manual
     * records the refund without touching the wallet. Guarded to `requested`
     * by the service (422 otherwise).
     */
    public function approve(Request $request, string $id): JsonResponse
    {
        $refund = $this->findInOrg($request, $id);

        $validated = $request->validate([
            'method' => ['nullable', 'in:wallet,manual'],
            'note' => ['nullable', 'string'],
        ]);

        $refund = app(RefundService::class)->approve(
            $refund,
            $validated['method'] ?? 'wallet',
            $validated['note'] ?? null,
            $request->user()->id,
        );

        return response()->json(['data' => $this->present($refund)]);
    }

    /** POST /owner/refunds/{id}/reject — reject a requested refund (no money moves). */
    public function reject(Request $request, string $id): JsonResponse
    {
        $refund = $this->findInOrg($request, $id);

        $validated = $request->validate([
            'note' => ['nullable', 'string'],
        ]);

        $refund = app(RefundService::class)->reject(
            $refund,
            $validated['note'] ?? null,
            $request->user()->id,
        );

        return response()->json(['data' => $this->present($refund)]);
    }

    /** Resolve a refund within the current org, 404 if missing / cross-org. */
    private function findInOrg(Request $request, string $id): Refund
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        return Refund::query()
            ->forOrganization($orgId)
            ->with(['booking:id,code', 'customer:id,display_name'])
            ->where('id', $id)
            ->firstOrFail();
    }

    /** Shape a Refund as the frontend OwnerRefund. */
    private function present(Refund $refund): array
    {
        return [
            'id' => (string) $refund->id,
            'bookingId' => (string) $refund->booking_id,
            'bookingCode' => $refund->booking?->code,
            'customerName' => $refund->customer?->display_name,
            'amount' => (float) $refund->amount,
            'reason' => $refund->reason,
            'status' => $refund->status,
            'method' => $refund->method,
            'requestedBy' => $refund->requested_by,
            'note' => $refund->note,
            'createdAt' => $refund->created_at?->toISOString(),
            'processedAt' => $refund->processed_at?->toISOString(),
        ];
    }
}
