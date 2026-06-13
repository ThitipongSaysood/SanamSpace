<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class BookingController extends Controller
{
    /**
     * GET /owner/bookings?status=&date=
     *
     * All bookings for the current org (newest first), optionally filtered by
     * status and/or date (Y-m-d). Each item includes customerName.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $bookings = Booking::query()
            ->forOrganization($orgId)
            ->with(['branch.organization', 'court', 'customer'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('date'), fn ($q) => $q->where('date', $request->string('date')))
            ->orderByDesc('created_at')
            ->get();

        return BookingResource::collection($bookings);
    }

    /**
     * GET /owner/bookings/{id} — one org-scoped booking (404 if other org).
     */
    public function show(Request $request, string $id): BookingResource
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $booking = Booking::query()
            ->forOrganization($orgId)
            ->with(['branch.organization', 'court', 'customer'])
            ->where('id', $id)
            ->firstOrFail();

        return new BookingResource($booking);
    }
}
