<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The wallet as money that can actually be spent.
 *
 * Until now `wallet` was an accepted payment-method string with no code behind
 * it: a customer could top up, the venue could approve the slip, and the
 * balance sat there forever because nothing ever deducted from it. Money in,
 * nothing out.
 *
 * Wallet and credit are NOT the same thing and are deliberately kept apart:
 * a wallet holds **baht** and can pay for anything, a package holds **hours**
 * and pays for court time. Merging them would mean converting hours to money at
 * some rate nobody agreed on.
 */
class WalletService
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
    public function spend(Customer $customer, float $amount, string $label, ?Booking $booking = null): Wallet
    {
        if ($amount <= 0) {
            throw ValidationException::withMessages(['amount' => 'จำนวนเงินต้องมากกว่า 0']);
        }

        return DB::transaction(function () use ($customer, $amount, $label, $booking) {
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
                'sort_order' => $this->nextSort($wallet),
            ]);

            return $wallet->fresh();
        });
    }

    /** Put money in — a venue credit, a goodwill adjustment, a refund. */
    public function credit(Customer $customer, float $amount, string $label): Wallet
    {
        if ($amount <= 0) {
            throw ValidationException::withMessages(['amount' => 'จำนวนเงินต้องมากกว่า 0']);
        }

        return DB::transaction(function () use ($customer, $amount, $label) {
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
