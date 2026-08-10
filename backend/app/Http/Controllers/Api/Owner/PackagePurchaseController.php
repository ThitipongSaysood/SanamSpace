<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\CustomerPackage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PackagePurchaseController extends Controller
{
    /**
     * GET /owner/package-purchases — customer package purchases awaiting approval
     * (status pending_review), org-scoped.
     */
    public function index(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $rows = CustomerPackage::query()
            ->forOrganization($orgId)
            ->where('status', 'pending_review')
            ->with('customer')
            ->orderBy('created_at')
            ->get()
            ->map(fn ($p) => [
                'id' => (string) $p->id,
                'customerId' => $p->customer?->id,
                'customerName' => $p->customer?->display_name,
                'packageName' => $p->name,
                'hours' => (float) $p->total_hours,
                'price' => (float) $p->price,
                'slipUrl' => $p->slip_url,
            ]);

        return response()->json(['data' => $rows]);
    }

    /** POST /owner/package-purchases/{id}/approve — activate (sets expiry). */
    public function approve(Request $request, string $id): JsonResponse
    {
        $purchase = $this->findPending($request, $id);

        $purchase->update([
            'status' => 'active',
            'expires_at' => now()->addDays((int) $purchase->valid_days)->toDateString(),
        ]);

        return response()->json(['id' => (string) $purchase->id, 'status' => 'active']);
    }

    /** POST /owner/package-purchases/{id}/reject. */
    public function reject(Request $request, string $id): JsonResponse
    {
        $purchase = $this->findPending($request, $id);
        $purchase->update(['status' => 'rejected']);

        return response()->json(['id' => (string) $purchase->id, 'status' => 'rejected']);
    }

    private function findPending(Request $request, string $id): CustomerPackage
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        return CustomerPackage::query()
            ->forOrganization($orgId)
            ->where('id', $id)
            ->where('status', 'pending_review')
            ->firstOrFail();
    }
}
