<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Shape: { id, name, category, price, stockQty, lowStockThreshold, imageUrl, isActive, sortOrder, stockState } */
class OwnerProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'category' => $this->category,
            'price' => (float) $this->price,
            'stockQty' => (int) $this->stock_qty,
            'lowStockThreshold' => (int) $this->low_stock_threshold,
            'imageUrl' => $this->image_url,
            'isActive' => (bool) $this->is_active,
            'sortOrder' => (int) $this->sort_order,
            // Computed once here so the till and the stock screen cannot
            // disagree about what "ใกล้หมด" means.
            'stockState' => $this->isOutOfStock() ? 'out' : ($this->isLowStock() ? 'low' : 'ok'),
        ];
    }
}
