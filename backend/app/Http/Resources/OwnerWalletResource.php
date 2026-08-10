<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Owner-portal (list) view of a Wallet joined to its customer.
 *
 * Shape: { id, customerName, balance, transactionCount }
 *
 * `transactionCount` is read from the `transactions_count` withCount aggregate
 * when present, otherwise 0. Expects the `customer` relation to be loaded.
 */
class OwnerWalletResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'customerId' => $this->customer_id ? (string) $this->customer_id : null,
            'customerName' => $this->customer?->display_name,
            'balance' => (float) $this->balance,
            'transactionCount' => (int) ($this->transactions_count ?? 0),
        ];
    }
}
