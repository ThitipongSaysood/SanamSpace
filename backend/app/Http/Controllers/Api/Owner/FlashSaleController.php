<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\FlashSale;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The venue's flash sales: a court discount that runs on chosen hours and
 * applies itself. Scope rows (branch or court) say where; none = the whole
 * venue. Soft-deleted so a past booking can still say which sale made it cheaper.
 */
class FlashSaleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $sales = FlashSale::query()
            ->forOrganization($request->attributes->get('currentOrganizationId'))
            ->with('scopes')
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $sales->map(fn (FlashSale $s) => $this->present($s))->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $data = $this->validated($request, $orgId, creating: true);

        $sale = FlashSale::create([
            'organization_id' => $orgId,
            'name' => $data['name'],
            'discount_type' => $data['discountType'] ?? 'percent',
            'discount_value' => $data['discountValue'],
            'max_discount' => $data['maxDiscount'] ?? null,
            'valid_from_time' => $data['validFromTime'],
            'valid_to_time' => $data['validToTime'],
            'valid_days' => $data['validDays'] ?? null,
            'starts_at' => $data['startsAt'] ?? null,
            'ends_at' => $data['endsAt'] ?? null,
            'is_active' => $data['isActive'] ?? true,
        ]);

        $this->syncScopes($sale, $data['branchIds'] ?? [], $data['courtIds'] ?? []);

        return response()->json(['data' => $this->present($sale->fresh('scopes'))], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $sale = $this->find($request, $id);
        $data = $this->validated($request, $orgId, creating: false);

        $map = [
            'name' => 'name', 'discountType' => 'discount_type', 'discountValue' => 'discount_value',
            'maxDiscount' => 'max_discount', 'validFromTime' => 'valid_from_time', 'validToTime' => 'valid_to_time',
            'validDays' => 'valid_days', 'startsAt' => 'starts_at', 'endsAt' => 'ends_at', 'isActive' => 'is_active',
        ];

        $updates = [];
        foreach ($map as $field => $column) {
            if (array_key_exists($field, $data)) {
                $updates[$column] = $data[$field];
            }
        }
        if ($updates) {
            $sale->update($updates);
        }

        // Scope is replaced only when the client sends it — a plain field edit
        // must not silently widen a sale to the whole venue.
        if (array_key_exists('branchIds', $data) || array_key_exists('courtIds', $data)) {
            $this->syncScopes($sale, $data['branchIds'] ?? [], $data['courtIds'] ?? []);
        }

        return response()->json(['data' => $this->present($sale->fresh('scopes'))]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->find($request, $id)->delete();

        return response()->json(null, 204);
    }

    /** Replace the sale's reach with the given branches + courts. */
    private function syncScopes(FlashSale $sale, array $branchIds, array $courtIds): void
    {
        $sale->scopes()->delete();

        foreach (array_unique($branchIds) as $branchId) {
            $sale->scopes()->create(['branch_id' => $branchId]);
        }
        foreach (array_unique($courtIds) as $courtId) {
            $sale->scopes()->create(['court_id' => $courtId]);
        }
    }

    private function present(FlashSale $s): array
    {
        return [
            'id' => (string) $s->id,
            'name' => $s->name,
            'discountType' => $s->discount_type,
            'discountValue' => (float) $s->discount_value,
            'maxDiscount' => $s->max_discount !== null ? (float) $s->max_discount : null,
            'validFromTime' => $s->valid_from_time,
            'validToTime' => $s->valid_to_time,
            'validDays' => $s->valid_days,
            'startsAt' => $s->starts_at?->toDateString(),
            'endsAt' => $s->ends_at?->toDateString(),
            'conditionLabel' => $s->conditionLabel(),
            'isActive' => (bool) $s->is_active,
            // Empty arrays mean the whole venue.
            'branchIds' => $s->scopes->whereNotNull('branch_id')->pluck('branch_id')->map(fn ($v) => (string) $v)->values(),
            'courtIds' => $s->scopes->whereNotNull('court_id')->pluck('court_id')->map(fn ($v) => (string) $v)->values(),
        ];
    }

    private function validated(Request $request, string $orgId, bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'name' => [$required, 'string', 'max:120'],
            'discountType' => ['sometimes', 'in:percent,fixed'],
            'discountValue' => [$required, 'numeric', 'min:0.01', 'max:100000'],
            'maxDiscount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            // A flash sale is a WINDOW — the hours are the whole point, so unlike
            // a coupon they are required.
            'validFromTime' => [$required, 'date_format:H:i'],
            'validToTime' => [$required, 'date_format:H:i', 'after:validFromTime'],
            'validDays' => ['sometimes', 'nullable', 'array'],
            'validDays.*' => ['integer', 'between:1,7'],
            'startsAt' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'endsAt' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'isActive' => ['sometimes', 'boolean'],
            // Reach: this venue's own branches and courts only.
            'branchIds' => ['sometimes', 'nullable', 'array'],
            'branchIds.*' => [Rule::exists('branches', 'id')->where('organization_id', $orgId)],
            'courtIds' => ['sometimes', 'nullable', 'array'],
            'courtIds.*' => [Rule::exists('courts', 'id')->where('organization_id', $orgId)],
        ]);
    }

    private function find(Request $request, string $id): FlashSale
    {
        return FlashSale::query()
            ->forOrganization($request->attributes->get('currentOrganizationId'))
            ->where('id', $id)
            ->firstOrFail();
    }
}
