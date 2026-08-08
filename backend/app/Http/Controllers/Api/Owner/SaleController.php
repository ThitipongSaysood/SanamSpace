<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Api\Concerns\PaginatesLists;
use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerSaleResource;
use App\Models\Organization;
use App\Models\OrganizationSetting;
use App\Models\ProductSale;
use App\Services\PosService;
use App\Services\PromptPayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/** The till: ringing up a sale, looking one up, putting one back. */
class SaleController extends Controller
{
    use PaginatesLists;

    public function __construct(private PosService $pos) {}

    /**
     * GET /owner/sales — receipts, newest first. `?date=Y-m-d` for one day's
     * takings, `?status=` to see only voided ones.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $sales = ProductSale::query()
            ->forOrganization($request->attributes->get('currentOrganizationId'))
            ->with(['items', 'seller'])
            ->when($request->filled('date'), fn ($q) => $q->whereDate('sold_at', $request->string('date')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByDesc('sold_at');

        return OwnerSaleResource::collection($this->paginated($sales, $request));
    }

    /**
     * GET /owner/sales/summary — today's takings for the till header.
     *
     * Voided sales are excluded from the money but counted separately, because
     * "we voided six today" is the number that tells you something is wrong.
     */
    public function summary(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $date = $request->filled('date') ? $request->string('date') : now()->toDateString();

        $base = ProductSale::query()->forOrganization($orgId)->whereDate('sold_at', $date);

        return response()->json([
            'date' => (string) $date,
            'total' => round((float) (clone $base)->where('status', 'completed')->sum('total'), 2),
            'saleCount' => (clone $base)->where('status', 'completed')->count(),
            'cashTotal' => round((float) (clone $base)->where('status', 'completed')->where('payment_method', 'cash')->sum('total'), 2),
            'transferTotal' => round((float) (clone $base)->where('status', 'completed')->where('payment_method', 'transfer')->sum('total'), 2),
            'voidedCount' => (clone $base)->where('status', 'voided')->count(),
        ]);
    }

    /**
     * POST /owner/sales — ring it up.
     *
     * Stock and money move together inside PosService's transaction, so a sale
     * that cannot be fully stocked takes nothing.
     */
    public function store(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.productId' => ['required', 'string'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:999'],
            'paymentMethod' => ['required', Rule::in(PosService::METHODS)],
        ]);

        $org = Organization::findOrFail($orgId);

        $sale = $this->pos->sell(
            $org,
            $validated['items'],
            $validated['paymentMethod'],
            $request->user(),
        );

        return (new OwnerSaleResource($sale))->response()->setStatusCode(201);
    }

    public function show(Request $request, string $id): OwnerSaleResource
    {
        return new OwnerSaleResource($this->find($request, $id)->load(['items', 'seller']));
    }

    /**
     * GET /owner/sales/{id}/promptpay — a scannable QR for this sale's total.
     *
     * Reuses the venue's configured PromptPay id, the same one bookings are paid
     * into. 422 when the venue has not set one, rather than drawing a QR that
     * pays nobody.
     */
    public function promptpay(Request $request, string $id, PromptPayService $promptpay): JsonResponse
    {
        $sale = $this->find($request, $id);
        $setting = OrganizationSetting::query()
            ->where('organization_id', $sale->organization_id)
            ->first();

        if (blank($setting?->promptpay_id)) {
            return response()->json([
                'message' => 'สนามยังไม่ได้ตั้งค่าพร้อมเพย์ — ตั้งได้ที่ ตั้งค่า › บัญชีรับเงิน',
            ], 422);
        }

        return response()->json([
            'amount' => (float) $sale->total,
            'payload' => $promptpay->payload($setting->promptpay_id, (float) $sale->total),
            'payTo' => $setting->promptpay_name,
        ]);
    }

    /** POST /owner/sales/{id}/void — put the stock back, keep the record. */
    public function void(Request $request, string $id): OwnerSaleResource
    {
        $validated = $request->validate([
            'reason' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        return new OwnerSaleResource(
            $this->pos->void($this->find($request, $id), $validated['reason'] ?? null),
        );
    }

    private function find(Request $request, string $id): ProductSale
    {
        return ProductSale::query()
            ->forOrganization($request->attributes->get('currentOrganizationId'))
            ->where('id', $id)
            ->firstOrFail();
    }
}
