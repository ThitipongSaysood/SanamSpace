<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** The venue's discount codes: what they are worth and who may still use them. */
class CouponController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $coupons = Coupon::query()
            ->forOrganization($request->attributes->get('currentOrganizationId'))
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $coupons->map(fn (Coupon $c) => $this->present($c))->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $data = $this->validated($request, $orgId, creating: true);

        $coupon = Coupon::create([
            'organization_id' => $orgId,
            'code' => $data['code'],
            'description' => $data['description'] ?? null,
            'type' => $data['type'] ?? 'percent',
            'value' => $data['value'],
            'min_amount' => $data['minAmount'] ?? 0,
            'max_discount' => $data['maxDiscount'] ?? null,
            'usage_limit' => $data['usageLimit'] ?? null,
            'per_customer_limit' => $data['perCustomerLimit'] ?? 1,
            'starts_at' => $data['startsAt'] ?? null,
            'ends_at' => $data['endsAt'] ?? null,
            'valid_from_time' => $data['validFromTime'] ?? null,
            'valid_to_time' => $data['validToTime'] ?? null,
            'valid_days' => $data['validDays'] ?? null,
            'is_active' => $data['isActive'] ?? true,
        ]);

        return response()->json(['data' => $this->present($coupon)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $coupon = $this->find($request, $id);
        $data = $this->validated($request, $orgId, creating: false, ignoreId: $coupon->id);

        $map = [
            'code' => 'code', 'description' => 'description', 'type' => 'type', 'value' => 'value',
            'minAmount' => 'min_amount', 'maxDiscount' => 'max_discount', 'usageLimit' => 'usage_limit',
            'perCustomerLimit' => 'per_customer_limit', 'startsAt' => 'starts_at', 'endsAt' => 'ends_at',
            'validFromTime' => 'valid_from_time', 'validToTime' => 'valid_to_time', 'validDays' => 'valid_days',
            'isActive' => 'is_active',
        ];

        $updates = [];
        foreach ($map as $field => $column) {
            if (array_key_exists($field, $data)) {
                $updates[$column] = $data[$field];
            }
        }

        if ($updates) {
            $coupon->update($updates);
        }

        return response()->json(['data' => $this->present($coupon->fresh())]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        // Soft delete: past bookings point at this row to say why they were
        // cheaper, and the snapshot on the booking keeps the receipt readable.
        $this->find($request, $id)->delete();

        return response()->json(null, 204);
    }

    private function present(Coupon $c): array
    {
        return [
            'id' => (string) $c->id,
            'code' => $c->code,
            'description' => $c->description,
            'type' => $c->type,
            'value' => (float) $c->value,
            'minAmount' => (float) $c->min_amount,
            'maxDiscount' => $c->max_discount !== null ? (float) $c->max_discount : null,
            'usageLimit' => $c->usage_limit,
            'perCustomerLimit' => (int) $c->per_customer_limit,
            'usedCount' => (int) $c->used_count,
            'startsAt' => $c->starts_at?->toDateString(),
            'endsAt' => $c->ends_at?->toDateString(),
            'validFromTime' => $c->valid_from_time,
            'validToTime' => $c->valid_to_time,
            'validDays' => $c->valid_days,
            // The rule in words, so a screen never has to reassemble it and
            // risk describing it differently from the code that enforces it.
            'conditionLabel' => $c->conditionLabel(),
            'isActive' => (bool) $c->is_active,
        ];
    }

    private function validated(Request $request, string $orgId, bool $creating, ?string $ignoreId = null): array
    {
        $required = $creating ? 'required' : 'sometimes';

        // Normalised before validating, not after: the unique rule compares
        // what was typed against what is stored, and stored codes are
        // uppercase. Without this "dup" sails past the check and dies on the
        // database constraint as a 500 instead of a readable 422.
        if ($request->filled('code')) {
            $request->merge(['code' => mb_strtoupper(trim($request->string('code')))]);
        }

        return $request->validate([
            'code' => [
                $required, 'string', 'max:40',
                // Unique per venue, not globally: two venues may both run
                // "OPEN50" and neither should block the other.
                Rule::unique('coupons', 'code')
                    ->where('organization_id', $orgId)
                    ->whereNull('deleted_at')
                    ->ignore($ignoreId),
            ],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'type' => ['sometimes', 'in:percent,fixed'],
            'value' => [$required, 'numeric', 'min:0.01', 'max:100000'],
            'minAmount' => ['sometimes', 'numeric', 'min:0'],
            'maxDiscount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'usageLimit' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'perCustomerLimit' => ['sometimes', 'integer', 'min:0'],
            'startsAt' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'endsAt' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            // "จอง 07:00–16:00 ลด 10%" — the hours the venue actually meant,
            // on its own wall clock, matching how bookings store theirs.
            'validFromTime' => ['sometimes', 'nullable', 'date_format:H:i'],
            'validToTime' => ['sometimes', 'nullable', 'date_format:H:i', 'after:validFromTime'],
            'validDays' => ['sometimes', 'nullable', 'array'],
            'validDays.*' => ['integer', 'between:1,7'],
            'isActive' => ['sometimes', 'boolean'],
        ]);
    }

    private function find(Request $request, string $id): Coupon
    {
        return Coupon::query()
            ->forOrganization($request->attributes->get('currentOrganizationId'))
            ->where('id', $id)
            ->firstOrFail();
    }
}
