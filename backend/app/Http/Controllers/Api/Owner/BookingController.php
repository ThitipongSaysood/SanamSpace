<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Api\Concerns\PaginatesLists;
use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\Court;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class BookingController extends Controller
{
    use PaginatesLists;

    /**
     * GET /owner/bookings?status=&date= — all org bookings (newest first).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $bookings = Booking::query()
            ->forOrganization($orgId)
            ->with(['branch.organization', 'court', 'customer'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('date'), fn ($q) => $q->where('date', $request->string('date')))
            // The calendar asks for the window it is showing. Without this the
            // board pulled every booking the venue ever took, to display one day.
            ->when($request->filled('from'), fn ($q) => $q->where('date', '>=', $request->string('from')))
            ->when($request->filled('to'), fn ($q) => $q->where('date', '<=', $request->string('to')))
            ->orderByDesc('created_at');

        return BookingResource::collection($this->paginated($bookings, $request));
    }

    /**
     * GET /owner/bookings/{id} — one org-scoped booking (404 if other org).
     */
    public function show(Request $request, string $id): BookingResource
    {
        $booking = $this->findScoped($request, $id);

        return new BookingResource($booking->load(['branch.organization', 'court', 'customer']));
    }

    /**
     * POST /owner/bookings — owner creates a booking (walk-in or for an existing
     * customer). Defaults to "confirmed" since the owner books directly.
     */
    public function store(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $data = $request->validate([
            'courtId' => ['required', 'string', Rule::exists('courts', 'id')->where('organization_id', $orgId)],
            'date' => ['required', 'date_format:Y-m-d'],
            'start' => ['required', 'date_format:H:i'],
            'end' => ['required', 'date_format:H:i', 'after:start'],
            'customerId' => ['nullable', 'string', Rule::exists('customers', 'id')->where('organization_id', $orgId)],
            'customerName' => ['nullable', 'string', 'max:255'],
            'status' => ['sometimes', Rule::in(['pending_payment', 'confirmed', 'completed', 'cancelled'])],
        ]);

        $court = Court::query()->forOrganization($orgId)->with('branch')->findOrFail($data['courtId']);
        $this->assertNoOverlap($court->id, $data['date'], $data['start'], $data['end']);
        $customer = $this->resolveCustomer($orgId, $data);

        $hours = $this->hoursBetween($data['start'], $data['end']);

        $booking = Booking::create([
            'organization_id' => $orgId,
            'branch_id' => $court->branch_id,
            'court_id' => $court->id,
            'customer_id' => $customer->id,
            'code' => $this->generateCode(),
            'date' => $data['date'],
            'start' => $data['start'],
            'end' => $data['end'],
            'amount' => round($hours * (float) $court->price_per_hour, 2),
            'status' => $data['status'] ?? 'confirmed',
            'channel' => 'walk_in', // created at the counter by staff
        ]);

        return (new BookingResource($booking->load(['branch.organization', 'court', 'customer'])))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * PUT /owner/bookings/{id} — reschedule / edit (court, date, time, status,
     * customer). Re-checks overlap and recomputes amount when time/court change.
     */
    public function update(Request $request, string $id): BookingResource
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $booking = $this->findScoped($request, $id);

        $data = $request->validate([
            'courtId' => ['sometimes', 'string', Rule::exists('courts', 'id')->where('organization_id', $orgId)],
            'date' => ['sometimes', 'date_format:Y-m-d'],
            'start' => ['sometimes', 'date_format:H:i'],
            'end' => ['sometimes', 'date_format:H:i'],
            'customerId' => ['sometimes', 'nullable', 'string', Rule::exists('customers', 'id')->where('organization_id', $orgId)],
            'customerName' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => ['sometimes', Rule::in(['pending_payment', 'confirmed', 'completed', 'cancelled'])],
        ]);

        $courtId = $data['courtId'] ?? $booking->court_id;
        $date = $data['date'] ?? $booking->date;
        $start = $data['start'] ?? $booking->start;
        $end = $data['end'] ?? $booking->end;

        if ($start >= $end) {
            throw ValidationException::withMessages(['end' => 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม']);
        }

        $court = Court::query()->forOrganization($orgId)->with('branch')->findOrFail($courtId);
        $this->assertNoOverlap($court->id, $date, $start, $end, $booking->id);

        $updates = [
            'court_id' => $court->id,
            'branch_id' => $court->branch_id,
            'date' => $date,
            'start' => $start,
            'end' => $end,
            'amount' => round($this->hoursBetween($start, $end) * (float) $court->price_per_hour, 2),
        ];
        if (array_key_exists('status', $data)) {
            $updates['status'] = $data['status'];
        }
        if (! empty($data['customerId'])) {
            $updates['customer_id'] = $data['customerId'];
        } elseif (! empty($data['customerName'])) {
            $updates['customer_id'] = $this->resolveCustomer($orgId, $data)->id;
        }

        $booking->update($updates);

        return new BookingResource($booking->fresh()->load(['branch.organization', 'court', 'customer']));
    }

    /**
     * POST /owner/bookings/{id}/cancel — mark cancelled (frees the slot).
     */
    public function cancel(Request $request, string $id): BookingResource
    {
        $booking = $this->findScoped($request, $id);
        $booking->update(['status' => 'cancelled']);

        return new BookingResource($booking->fresh()->load(['branch.organization', 'court', 'customer']));
    }

    /**
     * DELETE /owner/bookings/{id} — remove the row entirely.
     *
     * Different from cancel, which keeps it on the books as a cancelled slot.
     * This is for a mistake: a double entry, a test row, a wrong customer typed
     * in at the counter.
     *
     * Refused once money has been taken. A booking with an approved payment is a
     * financial record, and the honest way out of that is cancel-and-refund, not
     * making the row disappear.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $booking = $this->findScoped($request, $id);

        $paid = $booking->payments()->where('status', 'approved')->exists();

        if ($paid) {
            throw ValidationException::withMessages([
                'id' => 'ลบไม่ได้ — รายการนี้มีการชำระเงินที่อนุมัติแล้ว ให้ยกเลิกและคืนเงินแทน',
            ]);
        }

        $booking->delete(); // soft delete: recoverable if it was the wrong row

        return response()->json(null, 204);
    }

    private function findScoped(Request $request, string $id): Booking
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        return Booking::query()->forOrganization($orgId)->where('id', $id)->firstOrFail();
    }

    private function resolveCustomer(?string $orgId, array $data): Customer
    {
        if (! empty($data['customerId'])) {
            return Customer::query()->forOrganization($orgId)->findOrFail($data['customerId']);
        }
        if (! empty($data['customerName'])) {
            return Customer::create([
                'organization_id' => $orgId,
                'display_name' => $data['customerName'],
            ]);
        }
        throw ValidationException::withMessages([
            'customerName' => 'ต้องเลือกลูกค้า หรือกรอกชื่อลูกค้า (walk-in)',
        ]);
    }

    private function assertNoOverlap(string $courtId, string $date, string $start, string $end, ?string $exceptId = null): void
    {
        $overlaps = Booking::query()
            ->where('court_id', $courtId)
            ->where('date', $date)
            ->where('status', '!=', 'cancelled')
            ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))
            ->where('start', '<', $end)
            ->where('end', '>', $start)
            ->exists();

        if ($overlaps) {
            throw ValidationException::withMessages(['start' => 'ช่วงเวลานี้ถูกจองแล้วในคอร์ทนี้']);
        }

        $blocked = \App\Models\CourtBlock::query()
            ->where('court_id', $courtId)
            ->whereDate('date', $date)
            ->get()
            ->contains(fn ($b) => $b->covers($start, $end));

        if ($blocked) {
            throw ValidationException::withMessages(['start' => 'คอร์ทนี้ถูกปิด (ปิดปรับปรุง) ในช่วงเวลานี้']);
        }
    }

    private function hoursBetween(string $start, string $end): float
    {
        [$sh, $sm] = array_map('intval', explode(':', $start));
        [$eh, $em] = array_map('intval', explode(':', $end));

        return (($eh * 60 + $em) - ($sh * 60 + $sm)) / 60;
    }

    private function generateCode(): string
    {
        do {
            $code = 'BK-'.strtoupper(Str::random(6));
        } while (Booking::where('code', $code)->exists());

        return $code;
    }
}
