<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Api\Concerns\PaginatesLists;
use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerCustomerDetailResource;
use App\Http\Resources\OwnerCustomerResource;
use App\Models\Customer;
use App\Services\CustomerMergeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class CustomerController extends Controller
{
    use PaginatesLists;

    /**
     * GET /owner/customers — org customers with a per-customer bookings count.
     * Each item: { id, displayName, phone, email, totalSpending, visits, bookingsCount }
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $customers = Customer::query()
            ->forOrganization($orgId)
            ->withCount('bookings')
            // Credit and wallet on the list itself: "who has credit with us" is
            // a question asked while looking at the list, and answering it one
            // customer at a time means opening twenty of them.
            ->withSum(['packages as credit_hours' => fn ($q) => $q->where('status', 'active')], 'remaining_hours')
            ->with('wallet')
            ->orderByDesc('created_at');

        return OwnerCustomerResource::collection($this->paginated($customers, $request));
    }

    /**
     * GET /owner/customers/{id} — one customer, with their standing and their
     * recent bookings. 404 for a customer of another venue rather than a 403,
     * which would confirm the id exists.
     */
    public function show(Request $request, string $id): OwnerCustomerDetailResource
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $customer = Customer::query()
            ->forOrganization($orgId)
            ->withCount('bookings')
            ->with([
                'membership',
                'wallet',
                // Enough to see the pattern, not the whole history: the list is
                // for recognising a regular at the counter.
                'bookings' => fn ($q) => $q->with('court')->orderByDesc('date')->orderByDesc('start')->limit(20),
            ])
            ->where('id', $id)
            ->firstOrFail();

        return new OwnerCustomerDetailResource($customer);
    }

    /**
     * GET /owner/customers/duplicates — people who are in here more than once.
     *
     * Grouped by phone, because that is the only thing on a customer record
     * that identifies a person. Names are not: two customers called สมชาย are
     * two customers, and offering to merge them would be offering to move one
     * stranger's credit to another.
     *
     * Each side carries what would move, so the choice of which row to keep is
     * made with the consequences visible rather than by picking the older id.
     */
    public function duplicates(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $phones = Customer::query()
            ->forOrganization($orgId)
            ->whereNotNull('phone_normalized')
            ->select('phone_normalized')
            ->groupBy('phone_normalized')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('phone_normalized');

        if ($phones->isEmpty()) {
            return response()->json(['data' => []]);
        }

        $customers = Customer::query()
            ->forOrganization($orgId)
            ->whereIn('phone_normalized', $phones)
            ->withCount('bookings')
            ->with(['membership', 'wallet'])
            ->orderBy('created_at')
            ->get();

        $groups = $customers->groupBy('phone_normalized')->map(fn ($rows, $phone) => [
            'phone' => $phone,
            'customers' => $rows->map(fn (Customer $c) => [
                'id' => (string) $c->id,
                'displayName' => $c->display_name,
                'phone' => $c->phone,
                'email' => $c->email,
                'hasLine' => $c->line_user_id !== null,
                'bookingsCount' => (int) $c->bookings_count,
                'points' => (int) ($c->membership?->points ?? 0),
                'credit' => (float) ($c->wallet?->balance ?? 0),
                'createdAt' => $c->created_at?->toIso8601String(),
            ])->values(),
        ])->values();

        return response()->json(['data' => $groups]);
    }

    /**
     * POST /owner/customers/{id}/merge — fold a duplicate into this customer.
     *
     * `{id}` is the row that survives. Everything the duplicate holds moves to
     * it and the duplicate is soft-deleted; see CustomerMergeService for what
     * "everything" means and why nothing is recalculated.
     */
    public function merge(Request $request, string $id, CustomerMergeService $merges): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $data = $request->validate([
            'duplicateId' => ['required', 'string', Rule::exists('customers', 'id')->where('organization_id', $orgId)],
        ]);

        $keep = Customer::query()->forOrganization($orgId)->where('id', $id)->firstOrFail();
        $duplicate = Customer::query()->forOrganization($orgId)->where('id', $data['duplicateId'])->firstOrFail();

        $merged = $merges->merge($keep, $duplicate);

        return response()->json(['data' => [
            'id' => (string) $merged->id,
            'displayName' => $merged->display_name,
            'phone' => $merged->phone,
        ]]);
    }
}
