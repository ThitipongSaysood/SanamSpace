<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerPackage;
use App\Models\CustomerTimelineEntry;
use App\Models\Refund;
use Illuminate\Support\Facades\DB;

/**
 * The two data-subject rights that need code: get a copy, and be erased.
 *
 * PDPA gives a person the right to a copy of what a business holds on them and
 * the right to have it erased. Neither is absolute — Thai accounting law
 * requires a business to keep its financial records — so erasure here means
 * **anonymise the person, keep the transaction**. A booking that was paid for
 * stays on the books; the name attached to it stops being a name.
 *
 * Both operations are scoped to one customer of one venue, because that is what
 * a Customer row is: the same human at two venues is two records, and a request
 * to one venue is not a request to the other.
 */
class PersonalDataService
{
    /** What a deleted customer's name becomes. Not blank — blank reads as a bug. */
    public const ERASED_NAME = 'ผู้ใช้ที่ขอลบข้อมูลแล้ว';

    /**
     * Everything the venue holds about this customer, as plain arrays.
     *
     * Deliberately assembled by hand rather than dumping models: this is the
     * document a person reads to find out what a business knows, so it has to
     * be readable, and it must not leak another customer's rows through a
     * relation nobody checked.
     */
    public function export(Customer $customer): array
    {
        $bookings = $customer->bookings()
            ->with(['court', 'branch', 'rentals', 'payments'])
            ->orderByDesc('date')
            ->get()
            ->map(fn ($b) => [
                'code' => $b->code,
                'court' => $b->court?->name,
                'branch' => $b->branch?->name,
                'date' => $b->date,
                'start' => $b->start,
                'end' => $b->end,
                'status' => $b->status,
                'courtAmount' => (float) ($b->court_amount ?? 0),
                'rentalTotal' => (float) ($b->rental_total ?? 0),
                'amount' => (float) $b->amount,
                'checkedInAt' => $b->checked_in_at?->toIso8601String(),
                'createdAt' => $b->created_at?->toIso8601String(),
                'rentals' => $b->rentals->map(fn ($r) => [
                    'name' => $r->name,
                    'quantity' => (int) $r->quantity,
                    'lineTotal' => (float) $r->line_total,
                ])->values(),
                'payments' => $b->payments->map(fn ($p) => [
                    'method' => $p->method,
                    'amount' => (float) $p->amount,
                    'status' => $p->status,
                    // The slip is the customer's own upload; a copy request
                    // should tell them it is still held.
                    'slipUrl' => $p->slip_url,
                    'createdAt' => $p->created_at?->toIso8601String(),
                ])->values(),
            ])->values();

        $wallet = $customer->wallet;

        return [
            'exportedAt' => now()->toIso8601String(),
            'venue' => $customer->organization?->name,
            'profile' => [
                'displayName' => $customer->display_name,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'pictureUrl' => $customer->picture_url,
                'lineUserId' => $customer->line_user_id,
                'joinedAt' => $customer->created_at?->toIso8601String(),
                'totalSpending' => (float) $customer->total_spending,
                'visits' => (int) $customer->visits,
            ],
            'marketingConsent' => [
                'consent' => $customer->marketing_consent,
                'consentAt' => $customer->consent_at?->toIso8601String(),
                'unsubscribedAt' => $customer->unsubscribed_at?->toIso8601String(),
            ],
            'bookings' => $bookings,
            'wallet' => $wallet ? [
                'balance' => (float) $wallet->balance,
                'transactions' => $wallet->transactions()->orderByDesc('created_at')->get()
                    ->map(fn ($t) => [
                        'type' => $t->type,
                        'amount' => (float) $t->amount,
                        'status' => $t->status,
                        'note' => $t->note,
                        'createdAt' => $t->created_at?->toIso8601String(),
                    ])->values(),
            ] : null,
            'membership' => $customer->membership ? [
                'tier' => $customer->membership->tier,
                'points' => (int) $customer->membership->points,
            ] : null,
            'packages' => CustomerPackage::query()->where('customer_id', $customer->id)->get()
                ->map(fn ($p) => [
                    'name' => $p->name,
                    'totalHours' => (float) $p->total_hours,
                    'remainingHours' => (float) $p->remaining_hours,
                    'status' => $p->status,
                    'expiresAt' => $p->expires_at?->toDateString(),
                ])->values(),
            'refunds' => Refund::query()->where('customer_id', $customer->id)->get()
                ->map(fn ($r) => [
                    'amount' => (float) $r->amount,
                    'status' => $r->status,
                    'reason' => $r->reason,
                    'createdAt' => $r->created_at?->toIso8601String(),
                ])->values(),
            'notifications' => $customer->notifications()->orderByDesc('created_at')->get()
                ->map(fn ($n) => [
                    'title' => $n->title,
                    'body' => $n->body,
                    'createdAt' => $n->created_at?->toIso8601String(),
                ])->values(),
            'activityTimeline' => CustomerTimelineEntry::query()->where('customer_id', $customer->id)
                ->orderByDesc('created_at')->get()
                ->map(fn ($e) => [
                    'type' => $e->type,
                    'title' => $e->title,
                    'description' => $e->description,
                    'createdAt' => $e->created_at?->toIso8601String(),
                ])->values(),
        ];
    }

    /**
     * Erase the person, keep the transactions.
     *
     * What goes: name, phone, email, photo, the LINE identity that links the
     * record to a human, every LINE profile row, notifications and the activity
     * timeline — none of which any law requires a venue to keep.
     *
     * What stays: bookings, payments, refunds, wallet movements. Those are the
     * venue's accounts. They keep pointing at this row, which is now nobody.
     *
     * Clearing `line_user_id` matters twice: it breaks the link to the person,
     * and it means logging in again creates a fresh customer instead of
     * resurrecting the one they asked to erase.
     */
    public function erase(Customer $customer): void
    {
        DB::transaction(function () use ($customer) {
            $customer->lineProfiles()->delete();
            $customer->notifications()->delete();
            CustomerTimelineEntry::query()->where('customer_id', $customer->id)->delete();

            $customer->update([
                'display_name' => self::ERASED_NAME,
                'phone' => null,
                'email' => null,
                'picture_url' => null,
                'line_user_id' => null,
                // Not "they said no" — there is no longer anyone to ask, and
                // suppression must survive so nothing is ever sent here again.
                'marketing_consent' => false,
                'unsubscribed_at' => $customer->unsubscribed_at ?? now(),
            ]);

            // Any device still holding a token must stop being this customer.
            $customer->tokens()->delete();

            $customer->delete(); // soft delete: the financial rows still resolve
        });
    }
}
