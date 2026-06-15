<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Refund;
use App\Services\RefundService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Platform (super-admin) oversight of refunds across EVERY organization.
 *
 * Unlike the Owner portal this is intentionally NOT org-scoped: the operator
 * can review and override (approve/reject) any org's refund. All money logic is
 * delegated to RefundService so the wallet credit + state transition is never
 * duplicated here.
 */
class RefundController extends Controller
{
    /**
     * GET /admin/refunds — every refund across all orgs, `requested` first then newest.
     */
    public function index(Request $request): JsonResponse
    {
        $refunds = Refund::query()
            ->with(['booking', 'customer', 'organization'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            // Pending requests bubble to the top so the operator triages them first.
            ->orderByRaw("CASE WHEN status = 'requested' THEN 0 ELSE 1 END")
            ->orderByDesc('created_at')
            ->limit(300)
            ->get();

        return response()->json([
            'data' => $refunds->map(fn (Refund $refund) => $this->present($refund))->all(),
        ]);
    }

    /**
     * POST /admin/refunds/{id}/approve — credit the customer's wallet (or record a
     * manual/off-system refund) and cancel the booking. Any org.
     */
    public function approve(Request $request, string $id): JsonResponse
    {
        $refund = Refund::findOrFail($id);

        $data = $request->validate([
            'method' => ['nullable', 'in:wallet,manual'],
            'note' => ['nullable', 'string'],
        ]);

        $refund = app(RefundService::class)->approve(
            $refund,
            $data['method'] ?? 'wallet',
            $data['note'] ?? null,
            $request->user()->id,
        );

        return response()->json(['data' => $this->present($refund)]);
    }

    /**
     * POST /admin/refunds/{id}/reject — reject a requested refund (no money moves). Any org.
     */
    public function reject(Request $request, string $id): JsonResponse
    {
        $refund = Refund::findOrFail($id);

        $data = $request->validate([
            'note' => ['nullable', 'string'],
        ]);

        $refund = app(RefundService::class)->reject(
            $refund,
            $data['note'] ?? null,
            $request->user()->id,
        );

        return response()->json(['data' => $this->present($refund)]);
    }

    /** Shape a Refund as the frontend `AdminRefund`. */
    private function present(Refund $refund): array
    {
        return [
            'id' => (string) $refund->id,
            'bookingId' => (string) $refund->booking_id,
            'bookingCode' => $refund->booking?->code,
            'organizationName' => $refund->organization?->name,
            'customerName' => $refund->customer?->display_name,
            'amount' => (float) $refund->amount,
            'reason' => $refund->reason,
            'status' => $refund->status,
            'method' => $refund->method,
            'requestedBy' => $refund->requested_by,
            'note' => $refund->note,
            'createdAt' => $refund->created_at?->toIso8601String(),
            'processedAt' => $refund->processed_at?->toIso8601String(),
        ];
    }
}
