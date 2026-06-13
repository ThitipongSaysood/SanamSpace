<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\Court;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class BookingController extends Controller
{
    /**
     * GET /bookings -> Booking[] (current customer's bookings, newest first).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $bookings = Booking::query()
            ->with(['branch.organization', 'court'])
            ->where('customer_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->get();

        return BookingResource::collection($bookings);
    }

    /**
     * POST /bookings { venueId, courtId, date, start, end } -> Booking (201).
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'venueId' => ['required', 'string'],
            'courtId' => ['required', 'string'],
            'date' => ['required', 'date_format:Y-m-d'],
            'start' => ['required', 'date_format:H:i'],
            'end' => ['required', 'date_format:H:i', 'after:start'],
        ]);

        $customer = $request->user();

        // Resolve the court within the venue (venueId = org slug or branch id),
        // mirroring CourtController's resolution.
        $court = Court::query()
            ->with('branch.organization')
            ->where('id', $data['courtId'])
            ->whereHas('branch', function ($q) use ($data) {
                $q->where('id', $data['venueId'])
                    ->orWhereHas('organization', fn ($oq) => $oq->where('slug', $data['venueId']));
            })
            ->first();

        if (! $court) {
            throw ValidationException::withMessages([
                'courtId' => 'ไม่พบสนามที่เลือกในสถานที่นี้',
            ]);
        }

        // Reject overlap with an existing non-cancelled booking on this court/date.
        // Overlap iff existing.start < new.end AND existing.end > new.start.
        $overlaps = Booking::query()
            ->where('court_id', $court->id)
            ->where('date', $data['date'])
            ->where('status', '!=', 'cancelled')
            ->where('start', '<', $data['end'])
            ->where('end', '>', $data['start'])
            ->exists();

        if ($overlaps) {
            throw ValidationException::withMessages([
                'start' => 'ช่วงเวลานี้ถูกจองแล้ว',
            ]);
        }

        $hours = $this->hoursBetween($data['start'], $data['end']);
        // Pricing: amount = hours * price_per_hour (matches the frontend mock).
        // TODO: member discount / coupons
        $amount = round($hours * (float) $court->price_per_hour, 2);

        $booking = Booking::create([
            'organization_id' => $court->organization_id,
            'branch_id' => $court->branch_id,
            'court_id' => $court->id,
            'customer_id' => $customer->id,
            'code' => $this->generateCode(),
            'date' => $data['date'],
            'start' => $data['start'],
            'end' => $data['end'],
            'amount' => $amount,
            'status' => 'pending_payment',
        ]);

        $booking->load(['branch.organization', 'court']);

        return (new BookingResource($booking))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * GET /bookings/{id} -> Booking (404/403 if not owned by the customer).
     */
    public function show(Request $request, string $id): BookingResource
    {
        $booking = $this->findOwned($request, $id);

        return new BookingResource($booking);
    }

    /**
     * POST /bookings/{id}/cancel -> Booking (status cancelled).
     */
    public function cancel(Request $request, string $id): BookingResource
    {
        $booking = $this->findOwned($request, $id);
        $booking->update(['status' => 'cancelled']);

        return new BookingResource($booking->fresh(['branch.organization', 'court']));
    }

    /**
     * POST /bookings/{id}/checkin -> Booking (status completed).
     */
    public function checkin(Request $request, string $id): BookingResource
    {
        $booking = $this->findOwned($request, $id);
        $booking->update(['status' => 'completed']);

        return new BookingResource($booking->fresh(['branch.organization', 'court']));
    }

    /**
     * POST /bookings/{id}/checkout -> Booking (keeps completed; no-op).
     */
    public function checkout(Request $request, string $id): BookingResource
    {
        $booking = $this->findOwned($request, $id);

        if ($booking->status !== 'completed') {
            $booking->update(['status' => 'completed']);
        }

        return new BookingResource($booking->fresh(['branch.organization', 'court']));
    }

    /**
     * Fetch a booking owned by the current customer or abort (404).
     */
    private function findOwned(Request $request, string $id): Booking
    {
        return Booking::query()
            ->with(['branch.organization', 'court'])
            ->where('id', $id)
            ->where('customer_id', $request->user()->id)
            ->firstOrFail();
    }

    private function hoursBetween(string $start, string $end): float
    {
        [$sh, $sm] = array_map('intval', explode(':', $start));
        [$eh, $em] = array_map('intval', explode(':', $end));

        return (($eh * 60 + $em) - ($sh * 60 + $sm)) / 60;
    }

    /**
     * Generate a unique BK... booking code (e.g. BK260612A1B2C3).
     */
    private function generateCode(): string
    {
        do {
            $code = 'BK'.now()->format('ymd').strtoupper(Str::random(6));
        } while (Booking::where('code', $code)->exists());

        return $code;
    }
}
