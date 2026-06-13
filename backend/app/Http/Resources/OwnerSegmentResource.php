<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Owner-portal view of a CustomerSegment.
 *
 * Shape: { id, name, description, memberCount }
 *
 * `memberCount` is read from the `members_count` withCount aggregate when
 * present, otherwise falls back to the loaded `members` relation size, else 0.
 */
class OwnerSegmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'memberCount' => (int) ($this->members_count ?? $this->whenLoaded('members', fn () => $this->members->count(), 0)),
        ];
    }
}
