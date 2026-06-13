<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Owner-portal view of a customer timeline entry.
 *
 * Shape: { id, type, title, description, occurredAt }
 */
class OwnerTimelineResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'type' => $this->type,
            'title' => $this->title,
            'description' => $this->description,
            'occurredAt' => $this->occurred_at,
        ];
    }
}
