<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Reward;
use App\Models\RewardRedemption;
use App\Services\PointsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * What points are worth, and handing it over.
 *
 * Two ways in. Staff redeem directly at the counter — the customer says
 * "ขอแลกน้ำ" and it is done. Or the customer redeems in the app and brings a
 * code, which staff close here with `collect`.
 *
 * The app route only exists because the venue asked for it, and it is off by
 * default: a code nobody at the counter is expecting is worse than no button at
 * all. Uncollected ones are released by `points:expire` — points back to the
 * customer, stock back on the shelf — so the pending queue cannot only grow.
 */
class RewardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rewards = Reward::query()
            ->forOrganization($request->attributes->get('currentOrganizationId'))
            ->with('product')
            ->orderBy('sort_order')
            ->orderBy('points_cost')
            ->get();

        return response()->json(['data' => $rewards->map(fn (Reward $r) => $this->present($r))->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $data = $this->validated($request, $orgId, creating: true);

        $reward = Reward::create([
            'organization_id' => $orgId,
            'name' => $data['name'],
            'points_cost' => $data['pointsCost'],
            'type' => $data['type'] ?? 'product',
            'product_id' => $data['productId'] ?? null,
            'credit_amount' => $data['creditAmount'] ?? null,
            'hours' => $data['hours'] ?? null,
            'is_active' => $data['isActive'] ?? true,
            'sort_order' => (int) Reward::query()->forOrganization($orgId)->max('sort_order') + 1,
        ]);

        return response()->json(['data' => $this->present($reward->fresh('product'))], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $reward = $this->find($request, $id);
        $data = $this->validated($request, $orgId);

        $map = [
            'name' => 'name', 'pointsCost' => 'points_cost', 'type' => 'type',
            'productId' => 'product_id', 'creditAmount' => 'credit_amount',
            'hours' => 'hours', 'isActive' => 'is_active',
        ];

        $updates = [];
        foreach ($map as $field => $column) {
            if (array_key_exists($field, $data)) {
                $updates[$column] = $data[$field];
            }
        }

        if ($updates) {
            $reward->update($updates);
        }

        return response()->json(['data' => $this->present($reward->fresh('product'))]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        // Soft delete: past redemptions point here, and their snapshot keeps the
        // history readable.
        $this->find($request, $id)->delete();

        return response()->json(null, 204);
    }

    /**
     * POST /owner/rewards/{id}/redeem — hand it over at the counter.
     *
     * Points, stock and the record move together; see PointsService::redeem.
     */
    public function redeem(Request $request, string $id, PointsService $points): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $reward = $this->find($request, $id);

        $data = $request->validate([
            'customerId' => ['required', 'string', Rule::exists('customers', 'id')->where('organization_id', $orgId)],
        ]);

        $customer = Customer::query()->forOrganization($orgId)->findOrFail($data['customerId']);

        $redemption = $points->redeem($customer, $reward, $request->user()?->id);

        return response()->json(['data' => [
            'id' => (string) $redemption->id,
            'name' => $redemption->name,
            'pointsSpent' => (int) $redemption->points_spent,
        ]], 201);
    }

    /**
     * POST /owner/rewards/collect — hand over what a customer redeemed in the
     * app, by the code on their phone.
     *
     * The stock already left the shelf when they redeemed; this closes the
     * promise. Codes are matched case-insensitively because staff type them by
     * hand off a screen.
     */
    public function collect(Request $request, PointsService $points): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $data = $request->validate([
            'code' => ['required', 'string', 'max:12'],
        ]);

        $redemption = RewardRedemption::query()
            ->forOrganization($orgId)
            ->whereRaw('UPPER(code) = ?', [mb_strtoupper(trim($data['code']))])
            ->with('customer')
            ->first();

        if (! $redemption) {
            throw ValidationException::withMessages(['code' => 'ไม่พบรหัสนี้']);
        }

        $points->collect($redemption, $request->user()?->id);

        return response()->json(['data' => [
            'id' => (string) $redemption->id,
            'name' => $redemption->name,
            'customerId' => $redemption->customer?->id,
            'customerName' => $redemption->customer?->display_name,
        ]]);
    }

    /** GET /owner/rewards/redemptions — what has been handed over lately. */
    public function redemptions(Request $request): JsonResponse
    {
        $rows = RewardRedemption::query()
            ->forOrganization($request->attributes->get('currentOrganizationId'))
            ->with(['customer', 'staff', 'collector'])
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();

        return response()->json([
            'data' => $rows->map(fn (RewardRedemption $r) => [
                'id' => (string) $r->id,
                'name' => $r->name,
                'pointsSpent' => (int) $r->points_spent,
                'customerId' => $r->customer?->id,
                'customerName' => $r->customer?->display_name,
                // Whoever actually handled it: the counter staff who rang it
                // up, or — for an app redemption — whoever handed it over.
                'byName' => $r->staff?->display_name ?? $r->staff?->name
                    ?? $r->collector?->display_name ?? $r->collector?->name,
                'status' => $r->status,
                'code' => $r->status === 'pending' ? $r->code : null,
                'createdAt' => $r->created_at?->toIso8601String(),
            ])->values(),
        ]);
    }

    private function present(Reward $r): array
    {
        return [
            'id' => (string) $r->id,
            'name' => $r->name,
            'pointsCost' => (int) $r->points_cost,
            'type' => $r->type,
            'productId' => $r->product_id ? (string) $r->product_id : null,
            'productName' => $r->product?->name,
            // What the counter has left, so a reward nobody can collect is
            // visible as such rather than failing on the tap.
            'productStock' => $r->product ? (int) $r->product->stock_qty : null,
            'creditAmount' => $r->credit_amount !== null ? (float) $r->credit_amount : null,
            'hours' => $r->hours !== null ? (float) $r->hours : null,
            'isActive' => (bool) $r->is_active,
        ];
    }

    private function validated(Request $request, string $orgId, bool $creating = false): array
    {
        $required = $creating ? 'required' : 'sometimes';
        $type = $request->input('type', 'product');

        return $request->validate([
            'name' => [$required, 'string', 'max:255'],
            'pointsCost' => [$required, 'integer', 'min:1', 'max:1000000'],
            'type' => ['sometimes', Rule::in(Reward::TYPES)],
            // Each type needs its own field, and none of the others.
            'productId' => [
                $type === 'product' && $creating ? 'required' : 'nullable',
                'string',
                Rule::exists('products', 'id')->where('organization_id', $orgId),
            ],
            'creditAmount' => [$type === 'credit' && $creating ? 'required' : 'nullable', 'numeric', 'min:1'],
            'hours' => [$type === 'hours' && $creating ? 'required' : 'nullable', 'numeric', 'min:0.5'],
            'isActive' => ['sometimes', 'boolean'],
        ]);
    }

    private function find(Request $request, string $id): Reward
    {
        return Reward::query()
            ->forOrganization($request->attributes->get('currentOrganizationId'))
            ->where('id', $id)
            ->firstOrFail();
    }
}
