<?php

namespace App\Services;

use App\Models\Refund;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Central money logic for refunds, shared by the Owner and Admin portals so the
 * wallet credit + state transition is defined ONCE (never duplicated/diverged).
 *
 * Lifecycle: a Refund is created `requested` (by the customer). A staff member
 * then approves (crediting the customer wallet, or recording a manual/off-system
 * refund) or rejects it. Approve/reject are guarded to the `requested` state so a
 * refund can never be processed — or a wallet double-credited — twice.
 */
class RefundService
{
    /** Thai month abbreviations for wallet_transactions.txn_date (matches WalletController). */
    private const THAI_MONTHS = [
        1 => 'ม.ค.', 2 => 'ก.พ.', 3 => 'มี.ค.', 4 => 'เม.ย.', 5 => 'พ.ค.', 6 => 'มิ.ย.',
        7 => 'ก.ค.', 8 => 'ส.ค.', 9 => 'ก.ย.', 10 => 'ต.ค.', 11 => 'พ.ย.', 12 => 'ธ.ค.',
    ];

    public function __construct(private NotificationService $notifications) {}

    /**
     * Approve a requested refund. The venue refunds in CREDIT, not cash.
     *
     * One balance, in baht, whatever the money was originally for — the court
     * and the rented rackets are both baht, so both go back to the same place.
     * Splitting them by what they paid for is how a customer ends up with two
     * balances again.
     *
     * `manual` remains for money genuinely returned off-system (a bank
     * transfer the venue made by hand): the record has to be able to say that
     * happened without inventing credit the customer never received.
     *
     * @throws ValidationException when the refund is not in the `requested` state.
     */
    public function approve(Refund $refund, string $method = 'credit', ?string $note = null, ?string $processedBy = null): Refund
    {
        $this->assertRequested($refund);

        return DB::transaction(function () use ($refund, $method, $note, $processedBy) {
            if ($method !== 'manual') {
                $this->creditCustomer($refund);
            }

            $refund->update([
                'status' => 'approved',
                'method' => $method,
                'note' => $note,
                'processed_by' => $processedBy,
                'processed_at' => now(),
            ]);

            // A refunded booking is no longer active.
            $refund->booking?->update(['status' => 'cancelled']);

            $this->notifications->refundApproved($refund);

            return $refund->fresh(['booking', 'customer']);
        });
    }

    /** Reject a requested refund (no money moves). */
    public function reject(Refund $refund, ?string $note = null, ?string $processedBy = null): Refund
    {
        $this->assertRequested($refund);

        $refund->update([
            'status' => 'rejected',
            'note' => $note,
            'processed_by' => $processedBy,
            'processed_at' => now(),
        ]);

        $this->notifications->refundRejected($refund);

        return $refund->fresh(['booking', 'customer']);
    }

    private function assertRequested(Refund $refund): void
    {
        if ($refund->status !== 'requested') {
            throw ValidationException::withMessages([
                'refund' => 'คำขอคืนเงินนี้ถูกดำเนินการไปแล้ว',
            ]);
        }
    }

    /** Put the refund back as credit (creating the balance if needed) + log it. */
    private function creditCustomer(Refund $refund): void
    {
        $wallet = Wallet::firstOrCreate(
            ['organization_id' => $refund->organization_id, 'customer_id' => $refund->customer_id],
            ['balance' => 0],
        );

        $wallet->increment('balance', $refund->amount);

        $nextSort = (int) WalletTransaction::query()
            ->where('wallet_id', $wallet->id)
            ->max('sort_order') + 1;

        WalletTransaction::create([
            'wallet_id' => $wallet->id,
            'txn_date' => $this->thaiShortDate(),
            'label' => 'คืนเป็นเครดิต'.($refund->booking?->code ? ' · '.$refund->booking->code : ''),
            'amount' => $refund->amount,
            'sort_order' => $nextSort,
            'status' => 'completed',
            'source' => 'refund',
            'created_by' => $refund->processed_by,
        ]);
    }

    private function thaiShortDate(): string
    {
        $now = now();

        return $now->day.' '.(self::THAI_MONTHS[$now->month] ?? (string) $now->month);
    }
}
