<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Maps a Booking to the frontend `Booking` shape (lib/types.ts):
 * { id, code, venueId, venueName, courtId, courtName, date, start, end, amount, status, createdAt }
 *
 * venueId is the organization slug (matching the Venue id used elsewhere).
 *
 * `customerName` is emitted only when the `customer` relation is loaded (e.g.
 * owner-portal listings); it is omitted for customer-facing responses.
 */
class BookingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'code' => $this->code,
            'venueId' => $this->branch?->organization?->slug ?? $this->branch_id,
            'venueName' => $this->branch?->name ?? $this->branch?->organization?->name,
            'courtId' => (string) $this->court_id,
            'courtName' => $this->court?->name,
            'date' => $this->date,
            'start' => $this->start,
            'end' => $this->end,
            // The grand total the customer transfers, plus the parts it is
            // made of — a "why is it 550 not 500" answer, not a bare number.
            'amount' => (float) $this->amount,
            'courtAmount' => (float) ($this->court_amount ?? $this->amount),
            'rentalTotal' => (float) ($this->rental_total ?? 0),
            'rentals' => $this->whenLoaded('rentals', fn () => $this->rentals->map(fn ($r) => [
                'id' => (string) $r->id,
                'name' => $r->name,
                'unitPrice' => (float) $r->unit_price,
                'priceUnit' => $r->price_unit,
                'quantity' => (int) $r->quantity,
                'lineTotal' => (float) $r->line_total,
                // Whether the venue got it back. Partial by design: two out,
                // one back is a real counter moment.
                'returnedQty' => (int) ($r->returned_qty ?? 0),
                'returnedAt' => $r->returned_at?->toIso8601String(),
            ])->values(), []),
            // With deposits, a booking can be confirmed and still owe money, so
            // "what is left" has to be part of what a booking says about itself.
            // Why it is cheaper than the court price. Snapshotted on the
            // booking, so retiring a coupon cannot rewrite an old receipt.
            'discountAmount' => (float) ($this->discount_amount ?? 0),
            'discountLabel' => $this->discount_label,
            'depositAmount' => (float) ($this->deposit_amount ?? 0),
            'paidAmount' => (float) ($this->paid_amount ?? 0),
            'outstandingAmount' => max(0, round((float) $this->amount - (float) ($this->paid_amount ?? 0), 2)),
            // Credit spent on this booking. Hours, not baht: that is what the
            // venue sells and what the customer's balance is counted in, and a
            // booking paid this way otherwise looked like it was simply free.
            'credit' => $this->when((bool) $this->customer_package_id, fn () => [
                'packageName' => $this->customerPackage?->name,
                'hoursUsed' => (float) ($this->package_hours_used ?? 0),
                'redeemedAt' => $this->package_redeemed_at?->toIso8601String(),
                'remainingHours' => $this->customerPackage
                    ? (float) $this->customerPackage->remaining_hours
                    : null,
            ]),
            'status' => $this->status,
            'createdAt' => $this->created_at?->toIso8601String(),
            // Booking status alone cannot tell "not paid yet" from "slip sent,
            // waiting for the venue" — both sit at pending_payment, and the app
            // was asking people to pay a second time because of it.
            'paymentStatus' => $this->whenLoaded('latestPayment', fn () => $this->latestPayment?->status),
            'paymentId' => $this->whenLoaded('latestPayment', fn () => $this->latestPayment?->id),
            // The slip itself, so staff can read the transfer where they are
            // looking at the booking instead of hunting for the row on another
            // screen. Absolute URL, same as the payment endpoints emit.
            'paymentSlipUrl' => $this->whenLoaded('latestPayment', fn () => $this->latestPayment?->slip_url),
            'paymentMethod' => $this->whenLoaded('latestPayment', fn () => $this->latestPayment?->method),
            // What the customer's QR encodes, and when the counter scanned it.
            'checkinToken' => $this->checkin_token,
            'checkedInAt' => $this->checked_in_at?->toIso8601String(),
            $this->mergeWhen($this->relationLoaded('customer'), fn () => [
                'customerName' => $this->customer?->display_name,
            ]),
        ];
    }
}
