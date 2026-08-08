<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** One receipt, with its lines as they were charged. */
class OwnerSaleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'code' => $this->code,
            'total' => (float) $this->total,
            'paymentMethod' => $this->payment_method,
            'status' => $this->status,
            'soldAt' => $this->sold_at?->toIso8601String(),
            'voidedAt' => $this->voided_at?->toIso8601String(),
            'voidReason' => $this->void_reason,
            'sellerName' => $this->whenLoaded('seller', fn () => $this->seller?->display_name ?? $this->seller?->name),
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($i) => [
                'id' => (string) $i->id,
                'productId' => $i->product_id ? (string) $i->product_id : null,
                // The snapshot, not a join — this is what they were charged.
                'name' => $i->name,
                'unitPrice' => (float) $i->unit_price,
                'quantity' => (int) $i->quantity,
                'lineTotal' => (float) $i->line_total,
            ])->values(), []),
        ];
    }
}
