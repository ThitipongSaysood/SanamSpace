<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerTimelineResource;
use App\Models\Customer;
use App\Models\CustomerTimelineEntry;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TimelineController extends Controller
{
    /**
     * GET /owner/timeline/{customerId} — the customer's activity timeline,
     * newest first. The customer must belong to the current org (404 otherwise).
     * Each item: { id, type, title, description, occurredAt }
     */
    public function show(Request $request, string $customerId): AnonymousResourceCollection
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        // Ensure the customer exists in this org; 404 cross-org.
        Customer::query()
            ->forOrganization($orgId)
            ->where('id', $customerId)
            ->firstOrFail();

        $entries = CustomerTimelineEntry::query()
            ->forOrganization($orgId)
            ->where('customer_id', $customerId)
            ->orderByDesc('occurred_at')
            ->get();

        return OwnerTimelineResource::collection($entries);
    }
}
