<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Api\Concerns\PaginatesLists;
use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\Court;
use App\Models\Customer;
use App\Support\ThaiPhone;
use App\Models\Payment;
use App\Services\NotificationService;
use App\Services\RentalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class BookingController extends Controller
{
    use PaginatesLists;

    public function __construct(private RentalService $rentals) {}

    /**
     * GET /owner/bookings?status=&date= — all org bookings (newest first).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $bookings = Booking::query()
            ->forOrganization($orgId)
            // latestPayment: "pending_payment" covers both a booking nobody has
            // paid for and one whose slip is sitting in ตรวจสลิป waiting on the
            // venue. The list read as "รอชำระเงิน" for both, so staff could not
            // tell the rows they must chase from the rows they must action.
            ->with(['branch.organization', 'court', 'customer', 'rentals', 'latestPayment', 'customerPackage'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('date'), fn ($q) => $q->where('date', $request->string('date')))
            // The calendar asks for the window it is showing. Without this the
            // board pulled every booking the venue ever took, to display one day.
            ->when($request->filled('from'), fn ($q) => $q->where('date', '>=', $request->string('from')))
            ->when($request->filled('to'), fn ($q) => $q->where('date', '<=', $request->string('to')))
            ->orderByDesc('created_at');

        // A bounded date window is the calendar, and a calendar must return
        // EVERY booking it covers — paginating a busy month to 200 rows drops
        // whole days off the grid (they showed empty in the month view while the
        // day view, under the cap, had them). The date range is the bound;
        // reorder by date/time for the grid. The unranged list keeps its page.
        if ($request->filled('from') && $request->filled('to')) {
            return BookingResource::collection(
                $bookings->reorder()->orderBy('date')->orderBy('start')->get()
            );
        }

        return BookingResource::collection($this->paginated($bookings, $request));
    }

    /**
     * GET /owner/bookings/{id} — one org-scoped booking (404 if other org).
     */
    public function show(Request $request, string $id): BookingResource
    {
        $booking = $this->findScoped($request, $id);

        // rentals: the detail panel shows what the customer was charged for,
        // and a booking's total is no longer just the court.
        return new BookingResource($booking->load([
            'branch.organization', 'court', 'customer', 'rentals', 'latestPayment', 'customerPackage',
        ]));
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
            // The one thing that tells two walk-ins apart, and the same
            // customer's second visit from a new person.
            'customerPhone' => ['nullable', 'string', 'max:32'],
            'status' => ['sometimes', Rule::in(['pending_payment', 'confirmed', 'completed', 'cancelled'])],
            // A walk-in wants a racket too. Customers could rent from the app
            // since day one; the counter could not, which meant staff had to
            // take the booking here and the equipment somewhere else.
            'rentals' => ['sometimes', 'array'],
            'rentals.*.itemId' => ['required', 'string'],
            'rentals.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
        ]);

        $court = Court::query()->forOrganization($orgId)->with('branch')->findOrFail($data['courtId']);
        $customer = $this->resolveCustomer($orgId, $data);

        $hours = $this->hoursBetween($data['start'], $data['end']);

        // Serialize the overlap check + write behind the SAME lock the customer
        // app uses, so a counter booking and an app booking on one slot cannot
        // both pass their check at once (the double-booking race).
        $booking = $this->withCourtLock($court->id, $data['date'], function () use ($orgId, $court, $customer, $data, $hours) {
            $this->assertNoOverlap($court->id, $data['date'], $data['start'], $data['end']);

            // Priced and checked before anything is written, so a booking whose
            // equipment is unavailable is refused rather than half-created.
            $quote = $this->rentals->quote(
                $orgId,
                $data['rentals'] ?? [],
                $data['date'],
                $data['start'],
                $data['end'],
                $hours,
            );

            $booking = Booking::create([
                'organization_id' => $orgId,
                'branch_id' => $court->branch_id,
                'court_id' => $court->id,
                'customer_id' => $customer->id,
                'code' => $this->generateCode(),
                'date' => $data['date'],
                'start' => $data['start'],
                'end' => $data['end'],
                // Both, and equal: a walk-in has no rentals, but `court_amount`
                // left at its 0 default made the detail panel read "ค่าคอร์ท ฿0"
                // under a total of ฿250.
                'amount' => round($hours * (float) $court->price_per_hour, 2),
                'court_amount' => round($hours * (float) $court->price_per_hour, 2),
                'status' => $data['status'] ?? 'confirmed',
                'channel' => 'walk_in', // created at the counter by staff
            ]);

            if ($quote['rows'] !== []) {
                // Rewrites `amount` to court + rentals, so the counter charges the
                // same grand total the app would have.
                $this->rentals->attach($booking, $quote['rows'], $quote['total']);
            }

            // A walk-in the counter marks confirmed has been paid at the counter —
            // that is what taking the booking there means. Without this every
            // walk-in would read as owing its whole amount.
            $booking->refresh();
            if (in_array($booking->status, ['confirmed', 'completed'], true)) {
                $booking->update(['paid_amount' => $booking->amount]);
            }

            return $booking;
        });

        return (new BookingResource($booking->fresh()->load([
            'branch.organization', 'court', 'customer', 'rentals',
        ])))
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
            'customerPhone' => ['sometimes', 'nullable', 'string', 'max:32'],
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

        // Same lock as store / the customer app — a reschedule onto a slot must
        // race-check against every other create/reschedule on that court+date.
        $this->withCourtLock($court->id, $date, function () use ($orgId, $booking, $court, $data, $date, $start, $end) {
            $this->assertNoOverlap($court->id, $date, $start, $end, $booking->id);

            // `amount` is the grand total, court + rentals. Repricing only the court
            // part and writing it straight to `amount` dropped the rented rackets
            // off the bill — the customer was told one number and charged another.
            $courtAmount = round($this->hoursBetween($start, $end) * (float) $court->price_per_hour, 2);
            $rentalTotal = (float) ($booking->rental_total ?? 0);

            $updates = [
                'court_id' => $court->id,
                'branch_id' => $court->branch_id,
                'date' => $date,
                'start' => $start,
                'end' => $end,
                'court_amount' => $courtAmount,
                'amount' => round($courtAmount + $rentalTotal, 2),
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
        });

        return new BookingResource($booking->fresh()->load(['branch.organization', 'court', 'customer']));
    }

    /**
     * POST /owner/bookings/{id}/settle — the customer pays the rest at the desk.
     *
     * A deposit holds the court; the balance is usually handed over in cash
     * when they arrive. Without this the booking would owe money forever, and
     * "how much did we actually take today" would be wrong.
     */
    public function settle(Request $request, string $id, \App\Services\DepositService $deposits): BookingResource
    {
        $booking = $this->findScoped($request, $id);

        $data = $request->validate([
            'amount' => ['nullable', 'numeric', 'min:0.01'],
            'method' => ['nullable', 'string', 'in:cash,promptpay,transfer'],
        ]);

        $outstanding = $deposits->outstanding($booking);

        if ($outstanding <= 0) {
            throw ValidationException::withMessages([
                'amount' => 'รายการนี้ชำระครบแล้ว',
            ]);
        }

        // Defaults to everything left, which is what a counter almost always
        // means. A part payment is allowed but has to be asked for.
        $amount = round((float) ($data['amount'] ?? $outstanding), 2);

        if ($amount > $outstanding) {
            throw ValidationException::withMessages([
                'amount' => "ค้างชำระ ฿{$outstanding} รับเกินกว่านี้ไม่ได้",
            ]);
        }

        // Recorded as a payment, not just a number on the booking: this is money
        // received, and it belongs in the same place as every other payment.
        Payment::create([
            'organization_id' => $booking->organization_id,
            'booking_id' => $booking->id,
            'customer_id' => $booking->customer_id,
            'method' => $data['method'] ?? 'cash',
            'amount' => $amount,
            'status' => 'approved',
        ]);

        $deposits->applyPayment($booking, $amount);

        return new BookingResource($booking->fresh()->load([
            'branch.organization', 'court', 'customer', 'rentals', 'latestPayment', 'customerPackage',
        ]));
    }

    /**
     * POST /owner/bookings/{id}/cancel — mark cancelled (frees the slot).
     */
    public function cancel(Request $request, string $id, NotificationService $notifications): BookingResource
    {
        $booking = $this->findScoped($request, $id);
        $booking->update(['status' => 'cancelled']);
        $booking->closeOutstandingPayments();
        app(\App\Services\PointsService::class)->revokeForBooking($booking);

        $notifications->bookingCancelled($booking);

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

        // Otherwise its slip outlives it in the review queue, attached to a
        // booking the table can no longer name.
        $booking->closeOutstandingPayments();

        $booking->delete(); // soft delete: recoverable if it was the wrong row

        return response()->json(null, 204);
    }

    private function findScoped(Request $request, string $id): Booking
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        return Booking::query()->forOrganization($orgId)->where('id', $id)->firstOrFail();
    }

    /**
     * The customer this booking belongs to.
     *
     * A walk-in used to create a new row every single time, so the regular who
     * comes in every week and is booked by name became a new "customer" each
     * visit — each with their own points, credit and history, none of them
     * usable. With a phone number we look for the person who is already here.
     *
     * Matching is on the phone alone. Names are not identifying: two customers
     * called สมชาย are two people, and merging them on a name match would move
     * one stranger's credit to another.
     */
    private function resolveCustomer(?string $orgId, array $data): Customer
    {
        if (! empty($data['customerId'])) {
            return Customer::query()->forOrganization($orgId)->findOrFail($data['customerId']);
        }

        $phone = ThaiPhone::normalize($data['customerPhone'] ?? null);

        if ($phone !== null) {
            $existing = Customer::query()
                ->forOrganization($orgId)
                ->where('phone_normalized', $phone)
                ->orderBy('created_at')
                ->first();

            if ($existing) {
                // Staff often know the name before the phone; fill in a blank
                // rather than overwrite what the customer set themselves.
                if (! $existing->display_name && ! empty($data['customerName'])) {
                    $existing->update(['display_name' => $data['customerName']]);
                }

                return $existing;
            }
        }

        if (! empty($data['customerName'])) {
            return Customer::create([
                'organization_id' => $orgId,
                'display_name' => $data['customerName'],
                'phone' => $data['customerPhone'] ?? null,
            ]);
        }

        throw ValidationException::withMessages([
            'customerName' => 'ต้องเลือกลูกค้า หรือกรอกชื่อลูกค้า (walk-in)',
        ]);
    }

    /**
     * Run $write behind the SAME application lock the customer app uses
     * ("booking:court:{id}:{date}") wrapped in a transaction, so overlap
     * check + write is atomic across every booking path (app + counter). A DB
     * unique index can't express "no time-range overlap" and would wrongly
     * block re-booking a cancelled slot (cancelled rows are kept), so the guard
     * is the lock. `date` is a plain Y-m-d string (not cast), so the key matches.
     */
    private function withCourtLock(string $courtId, string $date, \Closure $write): mixed
    {
        return Cache::lock("booking:court:{$courtId}:{$date}", 10)
            ->block(5, fn () => DB::transaction($write));
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
