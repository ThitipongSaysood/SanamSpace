<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Credit: one customer balance, in baht.
 *
 * This was two things — a "wallet" in baht that nothing could ever spend, and
 * hour packages that only paid for court time. A customer held two balances in
 * two units and staff had to know which one a question was about, so the venue
 * asked for one. Baht, because that is what refunds and equipment are already
 * denominated in; hours would need a court rate to convert against.
 */
class CreditService
{
    /** Every customer conceptually has one; it just may not have a row yet. */
    public function forCustomer(Customer $customer): Wallet
    {
        return Wallet::query()->where('customer_id', $customer->id)->first()
            ?? Wallet::create([
                'organization_id' => $customer->organization_id,
                'customer_id' => $customer->id,
                'balance' => 0,
            ]);
    }

    /**
     * Spend from the balance, or refuse.
     *
     * Locked and re-read inside the transaction: two taps on "จ่ายด้วยวอลเล็ต"
     * would otherwise both read the same balance and both succeed, spending the
     * money twice. Reading the balance before the lock is the classic version
     * of this bug.
     */
    public function spend(
        Customer $customer,
        float $amount,
        string $label,
        ?Booking $booking = null,
        string $source = 'booking',
        ?string $actorId = null,
    ): Wallet
    {
        if ($amount <= 0) {
            throw ValidationException::withMessages(['amount' => 'จำนวนเงินต้องมากกว่า 0']);
        }

        return DB::transaction(function () use ($customer, $amount, $label, $source, $actorId) {
            $wallet = Wallet::query()
                ->where('customer_id', $customer->id)
                ->lockForUpdate()
                ->first() ?? $this->forCustomer($customer);

            $balance = (float) $wallet->balance;

            if ($balance + 0.001 < $amount) {
                $short = number_format($amount - $balance, 0);
                throw ValidationException::withMessages([
                    'amount' => "ยอดในวอลเล็ตไม่พอ ขาดอีก ฿{$short}",
                ]);
            }

            $wallet->update(['balance' => round($balance - $amount, 2)]);

            WalletTransaction::create([
                'wallet_id' => $wallet->id,
                'txn_date' => now()->toDateString(),
                'label' => $label,
                // Negative: a statement that only ever counts up is not a
                // statement, and "where did my money go" needs a row to point at.
                'amount' => -1 * round($amount, 2),
                'status' => 'approved',
                // Who and why. Credit is money that staff can create by hand,
                // so every line has to be answerable for.
                'created_by' => $actorId,
                'source' => $source,
                'sort_order' => $this->nextSort($wallet),
            ]);

            return $wallet->fresh();
        });
    }

    /** Put money in — a top-up, a goodwill adjustment, a refund. */
    public function add(
        Customer $customer,
        float $amount,
        string $label,
        string $source = 'adjustment',
        ?string $actorId = null,
    ): Wallet
    {
        if ($amount <= 0) {
            throw ValidationException::withMessages(['amount' => 'จำนวนเงินต้องมากกว่า 0']);
        }

        return DB::transaction(function () use ($customer, $amount, $label, $source, $actorId) {
            $wallet = Wallet::query()
                ->where('customer_id', $customer->id)
                ->lockForUpdate()
                ->first() ?? $this->forCustomer($customer);

            $wallet->update(['balance' => round((float) $wallet->balance + $amount, 2)]);

            WalletTransaction::create([
                'wallet_id' => $wallet->id,
                'txn_date' => now()->toDateString(),
                'label' => $label,
                'amount' => round($amount, 2),
                'status' => 'approved',
                'created_by' => $actorId,
                'source' => $source,
                'sort_order' => $this->nextSort($wallet),
            ]);

            return $wallet->fresh();
        });
    }

    /** Newest first is how the statement reads, so new rows sort ahead. */
    private function nextSort(Wallet $wallet): int
    {
        return (int) WalletTransaction::where('wallet_id', $wallet->id)->min('sort_order') - 1;
    }
}
