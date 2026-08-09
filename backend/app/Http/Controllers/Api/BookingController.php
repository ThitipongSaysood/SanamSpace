<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\Court;
use App\Models\OrganizationSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class BookingController extends Controller
{
    public function __construct(
        private \App\Services\RentalService $rentals,
        private \App\Services\DepositService $deposits,
        private \App\Services\DiscountService $discounts,
    ) {}

    /**
     * GET /bookings -> Booking[] (current customer's bookings, newest first).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $bookings = Booking::query()
            ->with(['branch.organization', 'court', 'rentals', 'latestPayment', 'customerPackage'])
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
            // Equipment picked on the booking screen, priced and checked for
            // availability against this same time window.
            'rentals' => ['sometimes', 'array'],
            'rentals.*.itemId' => ['required', 'string'],
            'rentals.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
            'couponCode' => ['sometimes', 'nullable', 'string', 'max:40'],
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

        $hours = $this->hoursBetween($data['start'], $data['end']);
        $amount = round($hours * (float) $court->price_per_hour, 2);

        // Serialize concurrent bookings on the SAME court+date so the
        // read-then-write overlap check can't be won by two people tapping the
        // same slot at once (the double-booking race). A DB unique index can't
        // express "no time-range overlap" and would wrongly block re-booking a
        // slot whose earlier booking was cancelled (cancelled rows are kept),
        // so the guard is an application lock around the check + insert instead.
        // Keyed per court+date: two different courts, or the same court on a
        // different day, never contend. Cache store is `database` (atomic-lock
        // capable). block(5) waits up to 5s for a slot rather than failing fast.
        $lock = Cache::lock("booking:court:{$court->id}:{$data['date']}", 10);

        $booking = $lock->block(5, function () use ($court, $customer, $data, $amount, $hours) {
            return DB::transaction(function () use ($court, $customer, $data, $amount, $hours) {
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

                // Reject if the court is blocked (maintenance / closure) for this slot.
                $blocked = \App\Models\CourtBlock::query()
                    ->where('court_id', $court->id)
                    ->whereDate('date', $data['date'])
                    ->get()
                    ->contains(fn ($b) => $b->covers($data['start'], $data['end']));

                if ($blocked) {
                    throw ValidationException::withMessages([
                        'start' => 'ช่วงเวลานี้ปิดให้บริการ (ปิดปรับปรุง)',
                    ]);
                }

                // Priced and checked BEFORE the booking row exists, so a
                // basket the venue cannot equip takes no court slot either.
                $quote = $this->rentals->quote(
                    $court->organization_id,
                    $data['rentals'] ?? [],
                    $data['date'],
                    $data['start'],
                    $data['end'],
                    $hours,
                );

                $booking = Booking::create([
                    'organization_id' => $court->organization_id,
                    'branch_id' => $court->branch_id,
                    'court_id' => $court->id,
                    'customer_id' => $customer->id,
                    'code' => $this->generateCode(),
                    'date' => $data['date'],
                    'start' => $data['start'],
                    'end' => $data['end'],
                    'court_amount' => $amount,
                    'rental_total' => 0,
                    // Grand total; attach() adds the rentals to it below.
                    'amount' => $amount,
                    'status' => 'pending_payment',
                    'channel' => 'application',
                ]);

                $this->rentals->attach($booking, $quote['rows'], $quote['total']);

                // Discount and deposit both come after attach, because both are
                // a share of the grand total — court plus whatever was rented
                // with it. A coupon applied to the court alone would be a
                // different, smaller promise than the one shown at checkout.
                $booking->refresh();
                $settings = OrganizationSetting::query()
                    ->where('organization_id', $court->organization_id)
                    ->first();

                $discount = $this->discounts->resolve(
                    $court->organization_id,
                    (float) $booking->amount,
                    $customer,
                    $data['couponCode'] ?? null,
                    $settings,
                );

                $payable = round((float) $booking->amount - $discount['amount'], 2);

                $booking->update([
                    'discount_amount' => $discount['amount'],
                    'discount_label' => $discount['label'],
                    'coupon_id' => $discount['coupon']?->id,
                    'amount' => $payable,
                    'deposit_amount' => $this->deposits->depositFor($settings, $payable),
                ]);

                if ($discount['coupon']) {
                    // Inside the transaction: a booking that fails after this
                    // point must not burn the customer's one use of the code.
                    $this->discounts->redeem($discount['coupon'], $customer, $booking->id, $discount['amount']);
                }

                return $booking->fresh();
            });
        });

        $booking->load(['branch.organization', 'court', 'rentals', 'latestPayment', 'customerPackage']);

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
     *
     * Money already paid comes back as CREDIT, immediately. The venue's policy
     * is credit rather than cash, and credit costs the venue nothing to return —
     * so making the customer file a request and wait for approval would be
     * ceremony around a decision that has already been made.
     */
    public function cancel(Request $request, string $id, \App\Services\CreditService $credit): BookingResource
    {
        $booking = $this->findOwned($request, $id);

        if ($booking->status === 'cancelled') {
            throw ValidationException::withMessages(['booking' => 'การจองนี้ถูกยกเลิกไปแล้ว']);
        }

        // Read before the status changes, and only what was actually received.
        $refundable = round((float) ($booking->paid_amount ?? 0), 2);

        $booking->update(['status' => 'cancelled']);
        // A slip sent minutes before cancelling must not stay in the venue's
        // review queue, where approving it would revive the booking.
        $booking->closeOutstandingPayments();

        // Points go back with the money. Without this the farm is: pay, collect
        // the points, cancel, take the money back as credit, keep the points.
        app(\App\Services\PointsService::class)->revokeForBooking($booking);

        if ($refundable > 0) {
            $credit->add(
                $request->user(),
                $refundable,
                'คืนจากการยกเลิก · '.$booking->code,
                'refund',
            );

            // The booking now owes nothing and has given everything back, so it
            // must not still read as "฿250 paid" on a cancelled row.
            $booking->update(['paid_amount' => 0]);
        }

        return new BookingResource($booking->fresh([
            'branch.organization', 'court', 'rentals', 'latestPayment', 'customerPackage',
        ]));
    }

    /**
     * POST /bookings/{id}/pay-with-package { customerPackageId } -> Booking
     *
     * Redeem an active package: deduct the booking's hours and confirm it
     * (amount becomes 0 — the package purchase was the revenue).
     */
    public function payWithPackage(Request $request, string $id): BookingResource
    {
        $data = $request->validate([
            'customerPackageId' => ['required', 'string'],
        ]);

        $booking = $this->findOwned($request, $id);

        if ($booking->status !== 'pending_payment') {
            throw ValidationException::withMessages(['booking' => 'รายการจองนี้ชำระเงินแล้ว']);
        }

        // A booking whose court is already on a package stays pending while the
        // equipment is unpaid — without this, a second package could be spent
        // on the same court hour, buying nothing.
        if ($booking->customer_package_id) {
            throw ValidationException::withMessages([
                'booking' => 'ค่าสนามของรายการนี้ใช้แพ็กเกจไปแล้ว — ส่วนที่เหลือเป็นค่าเช่าอุปกรณ์',
            ]);
        }

        $package = \App\Models\CustomerPackage::query()
            ->where('id', $data['customerPackageId'])
            ->where('customer_id', $request->user()->id)
            ->where('organization_id', $booking->organization_id)
            ->first();

        if (! $package || ! $package->isUsable()) {
            throw ValidationException::withMessages(['customerPackageId' => 'แพ็กเกจใช้งานไม่ได้ (หมดอายุหรือถูกระงับ)']);
        }

        $hours = $this->hoursBetween($booking->start, $booking->end);
        if ($package->remaining_hours < $hours) {
            throw ValidationException::withMessages(['customerPackageId' => 'ชั่วโมงในแพ็กเกจไม่พอ']);
        }

        $package->decrement('remaining_hours', $hours);

        // A package buys court hours. It does not buy the rackets — so what is
        // left to pay is the rental total, and the booking is only settled when
        // that is nothing. Zeroing `amount` outright handed the gear over free.
        $stillOwed = round((float) ($booking->rental_total ?? 0), 2);

        $booking->update([
            'amount' => $stillOwed,
            'status' => $stillOwed > 0 ? 'pending_payment' : 'confirmed',
            'customer_package_id' => $package->id,
            'package_redeemed_at' => now(),
            // What it actually cost them in credit, snapshotted — rescheduling
            // the booking later must not rewrite the receipt.
            'package_hours_used' => $hours,
        ]);

        return new BookingResource($booking->fresh(['branch.organization', 'court']));
    }

    /**
     * POST /bookings/{id}/pay-with-credit — spend the balance on this booking.
     *
     * Settled on the spot: the venue is already holding this money, so there is
     * no slip to send and nothing to review. That is the whole difference
     * between paying from a wallet and paying by transfer.
     */
    public function payWithCredit(Request $request, \App\Services\CreditService $credit, \App\Services\DepositService $deposits): BookingResource
    {
        $booking = $this->findOwned($request, $request->route('id'));

        if ($booking->status === 'cancelled') {
            throw ValidationException::withMessages(['booking' => 'การจองนี้ถูกยกเลิกแล้ว']);
        }

        $outstanding = $deposits->outstanding($booking);

        if ($outstanding <= 0) {
            throw ValidationException::withMessages(['booking' => 'รายการจองนี้ชำระเงินเรียบร้อยแล้ว']);
        }

        $data = $request->validate([
            // Part-paying from credit is allowed — someone with ฿100 left
            // should be able to put it towards a ฿250 court rather than being
            // told the balance is useless.
            'amount' => ['sometimes', 'numeric', 'min:1'],
        ]);

        $amount = round(min((float) ($data['amount'] ?? $outstanding), $outstanding), 2);

        $credit->spend(
            $request->user(),
            $amount,
            'จ่ายค่าจอง '.$booking->code,
            $booking,
        );

        // Recorded as a payment like any other: this is money received, and the
        // venue's takings should not depend on which pocket it came from.
        \App\Models\Payment::create([
            'organization_id' => $booking->organization_id,
            'booking_id' => $booking->id,
            'customer_id' => $booking->customer_id,
            'method' => 'credit',
            'amount' => $amount,
            'status' => 'approved',
        ]);

        $deposits->applyPayment($booking, $amount);

        return new BookingResource($booking->fresh()->load([
            'branch.organization', 'court', 'rentals', 'latestPayment', 'customerPackage',
        ]));
    }

    /**
     * Fetch a booking owned by the current customer or abort (404).
     */
    private function findOwned(Request $request, string $id): Booking
    {
        return Booking::query()
            ->with(['branch.organization', 'court', 'rentals', 'latestPayment', 'customerPackage'])
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
