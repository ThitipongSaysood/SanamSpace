<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\RentalItemResource;
use App\Models\BookingRental;
use App\Models\RentalItem;
use App\Services\RentalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/** The venue's equipment: what it lends out, and how many it owns. */
class RentalItemController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $items = RentalItem::query()
            ->forOrganization($request->attributes->get('currentOrganizationId'))
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return RentalItemResource::collection($items);
    }

    /**
     * GET /owner/rental-items/offer?date&start&end — what the counter can rent
     * for a slot, priced for it.
     *
     * The customer app has the same thing at GET /rentals, but that route is
     * authenticated as a customer, so staff cannot call it. Both go through
     * RentalService::offer, so the counter and the app can never promise the
     * same racket to two people.
     */
    public function offer(Request $request, RentalService $rentals): AnonymousResourceCollection
    {
        $data = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'start' => ['required', 'date_format:H:i'],
            'end' => ['required', 'date_format:H:i', 'after:start'],
        ]);

        $hours = (strtotime($data['end']) - strtotime($data['start'])) / 3600;

        return RentalItemResource::collection($rentals->offer(
            $request->attributes->get('currentOrganizationId'),
            $data['date'],
            $data['start'],
            $data['end'],
            $hours,
        ));
    }

    /**
     * GET /owner/rental-items/out — what is out right now.
     *
     * The question at the counter when someone returns a racket and the shelf
     * still looks short.
     */
    public function out(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $now = now()->timezone(config('app.timezone'));
        $date = $request->filled('date') ? $request->string('date') : $now->toDateString();

        $rows = BookingRental::query()
            ->with(['booking.customer', 'booking.court'])
            ->whereHas('booking', fn ($q) => $q->where('organization_id', $orgId)
                ->where('date', $date)
                ->where('status', '!=', 'cancelled'))
            ->get()
            ->map(fn ($r) => [
                'id' => (string) $r->id,
                'name' => $r->name,
                'quantity' => (int) $r->quantity,
                'bookingCode' => $r->booking?->code,
                'customerName' => $r->booking?->customer?->display_name,
                'courtName' => $r->booking?->court?->name,
                'start' => $r->booking?->start,
                'end' => $r->booking?->end,
                'status' => $r->booking?->status,
            ])
            ->values();

        return response()->json(['date' => (string) $date, 'data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $data = $this->validated($request, creating: true);

        $item = RentalItem::create([
            'organization_id' => $orgId,
            'name' => $data['name'],
            'category' => $data['category'] ?? null,
            'price' => $data['price'],
            'price_unit' => $data['priceUnit'] ?? 'per_session',
            'stock_qty' => $data['stockQty'] ?? 0,
            'image_url' => $data['imageUrl'] ?? null,
            'note' => $data['note'] ?? null,
            'is_active' => $data['isActive'] ?? true,
            'sort_order' => (int) RentalItem::query()->forOrganization($orgId)->max('sort_order') + 1,
        ]);

        return (new RentalItemResource($item))->response()->setStatusCode(201);
    }

    public function update(Request $request, string $id): RentalItemResource
    {
        $item = $this->find($request, $id);
        $data = $this->validated($request);

        $columns = [
            'name' => 'name',
            'category' => 'category',
            'price' => 'price',
            'priceUnit' => 'price_unit',
            'stockQty' => 'stock_qty',
            'imageUrl' => 'image_url',
            'note' => 'note',
            'isActive' => 'is_active',
        ];

        $updates = [];
        foreach ($columns as $field => $column) {
            if (array_key_exists($field, $data)) {
                $updates[$column] = $data[$field];
            }
        }

        if ($updates) {
            $item->update($updates);
        }

        return new RentalItemResource($item->fresh());
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        // Soft delete: past bookings point here, and their snapshot keeps the
        // line readable, but the row should not vanish from history.
        $this->find($request, $id)->delete();

        return response()->json(null, 204);
    }

    private function validated(Request $request, bool $creating = false): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'name' => [$required, 'string', 'max:255'],
            'price' => [$required, 'numeric', 'min:0', 'max:999999'],
            'priceUnit' => ['sometimes', Rule::in(RentalItem::UNITS)],
            'category' => ['sometimes', 'nullable', 'string', 'max:80'],
            'stockQty' => ['sometimes', 'integer', 'min:0'],
            'imageUrl' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'note' => ['sometimes', 'nullable', 'string', 'max:500'],
            'isActive' => ['sometimes', 'boolean'],
        ]);
    }

    private function find(Request $request, string $id): RentalItem
    {
        return RentalItem::query()
            ->forOrganization($request->attributes->get('currentOrganizationId'))
            ->where('id', $id)
            ->firstOrFail();
    }
}
