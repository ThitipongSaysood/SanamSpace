<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerProductResource;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** The venue's own catalogue: what the counter sells and how much is left. */
class ProductController extends Controller
{
    /**
     * GET /owner/products — the catalogue. `?sellable=1` narrows it to what the
     * till may show (active only, in the venue's order).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Product::query()
            ->forOrganization($request->attributes->get('currentOrganizationId'));

        $request->boolean('sellable')
            ? $query->sellable()
            : $query->orderBy('sort_order')->orderBy('name');

        return OwnerProductResource::collection($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $data = $this->validated($request, creating: true);

        $product = Product::create([
            'organization_id' => $orgId,
            'name' => $data['name'],
            'category' => $data['category'] ?? null,
            'price' => $data['price'],
            'stock_qty' => $data['stockQty'] ?? 0,
            'low_stock_threshold' => $data['lowStockThreshold'] ?? 5,
            'image_url' => $data['imageUrl'] ?? null,
            'is_active' => $data['isActive'] ?? true,
            'sort_order' => (int) Product::query()->forOrganization($orgId)->max('sort_order') + 1,
        ]);

        return (new OwnerProductResource($product))->response()->setStatusCode(201);
    }

    public function update(Request $request, string $id): OwnerProductResource
    {
        $product = $this->find($request, $id);
        $data = $this->validated($request);

        $columns = [
            'name' => 'name',
            'category' => 'category',
            'price' => 'price',
            'stockQty' => 'stock_qty',
            'lowStockThreshold' => 'low_stock_threshold',
            'imageUrl' => 'image_url',
            'isActive' => 'is_active',
        ];

        $updates = [];
        foreach ($columns as $field => $column) {
            if (array_key_exists($field, $data)) {
                $updates[$column] = $data[$field];
            }
        }

        if ($updates) {
            $product->update($updates);
        }

        return new OwnerProductResource($product->fresh());
    }

    /**
     * POST /owner/products/{id}/stock — { delta } to add or remove, or { set }
     * to correct after a stock-take.
     *
     * Separate from `update` because restocking is a different act from editing
     * a price, and "+24" is what someone actually does when a delivery arrives.
     */
    public function adjustStock(Request $request, string $id): OwnerProductResource
    {
        $product = $this->find($request, $id);

        $data = $request->validate([
            'delta' => ['required_without:set', 'integer'],
            'set' => ['required_without:delta', 'integer', 'min:0'],
        ]);

        $next = array_key_exists('set', $data)
            ? (int) $data['set']
            : $product->stock_qty + (int) $data['delta'];

        // Stock cannot be negative: a count below zero is a mistake, not a fact.
        $product->update(['stock_qty' => max(0, $next)]);

        return new OwnerProductResource($product->fresh());
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        // Soft delete: past sale lines point here, and their snapshot keeps them
        // readable, but the row itself should not vanish from history.
        $this->find($request, $id)->delete();

        return response()->json(null, 204);
    }

    private function validated(Request $request, bool $creating = false): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'name' => [$required, 'string', 'max:255'],
            'price' => [$required, 'numeric', 'min:0', 'max:999999'],
            'category' => ['sometimes', 'nullable', 'string', 'max:80'],
            'stockQty' => ['sometimes', 'integer', 'min:0'],
            'lowStockThreshold' => ['sometimes', 'integer', 'min:0'],
            'imageUrl' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'isActive' => ['sometimes', 'boolean'],
        ]);
    }

    private function find(Request $request, string $id): Product
    {
        return Product::query()
            ->forOrganization($request->attributes->get('currentOrganizationId'))
            ->where('id', $id)
            ->firstOrFail();
    }
}
