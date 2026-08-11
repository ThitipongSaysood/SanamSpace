<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Owner-portal (management) view of a Promotion. Unlike the customer-facing
 * PromotionResource, this includes `sortOrder` for ordering in the admin UI.
 *
 * Shape: { id, title, subtitle, tag, sortOrder }
 */
class OwnerPromotionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'title' => $this->title,
            'subtitle' => $this->subtitle,
            'tag' => $this->tag,
            'sortOrder' => (int) $this->sort_order,
            'isActive' => (bool) $this->is_active,
            'couponId' => $this->coupon_id ? (string) $this->coupon_id : null,
            'couponCode' => $this->whenLoaded('coupon', fn () => $this->coupon?->code),
        ];
    }
}
