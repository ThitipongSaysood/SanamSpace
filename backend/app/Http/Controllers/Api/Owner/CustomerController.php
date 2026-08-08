<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Api\Concerns\PaginatesLists;
use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerCustomerDetailResource;
use App\Http\Resources\OwnerCustomerResource;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

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
}
