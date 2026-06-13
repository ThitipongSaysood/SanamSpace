<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerCustomerResource;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CustomerController extends Controller
{
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
            ->orderByDesc('created_at')
            ->get();

        return OwnerCustomerResource::collection($customers);
    }
}
