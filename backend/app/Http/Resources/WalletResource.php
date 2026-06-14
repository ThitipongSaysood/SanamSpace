<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Maps a Wallet (+ its transactions) to the frontend `Wallet` shape
 * (lib/types.ts):
 * { balance, transactions: [{ id, date, label, amount }] }
 */
class WalletResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'balance' => (float) $this->balance,
            'transactions' => $this->transactions->map(fn ($txn) => [
                'id' => (string) $txn->id,
                'date' => $txn->txn_date,
                'label' => $txn->label,
                'amount' => (float) $txn->amount,
                'status' => $txn->status ?? 'completed',
            ])->values(),
        ];
    }
}
