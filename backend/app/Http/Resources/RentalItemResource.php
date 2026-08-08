<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A rentable item.
 *
 * `availableQty` and `priceForBooking` only appear when the caller asked about a
 * specific time window — "3 left" is meaningless without saying 3 left *when*.
 */
class RentalItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'category' => $this->category,
            'price' => (float) $this->price,
            'priceUnit' => $this->price_unit,
            'stockQty' => (int) $this->stock_qty,
            'imageUrl' => $this->image_url,
            'note' => $this->note,
            'isActive' => (bool) $this->is_active,
            'sortOrder' => (int) $this->sort_order,
            $this->mergeWhen($this->available_qty !== null, fn () => [
                'availableQty' => (int) $this->available_qty,
                'priceForBooking' => (float) $this->price_for_booking,
            ]),
        ];
    }
}
