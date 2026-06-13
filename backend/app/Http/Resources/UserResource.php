<?php

namespace App\Http\Resources;

use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Maps a Customer or admin User to the frontend `User` shape (lib/types.ts):
 * { id, displayName, lineId, avatarUrl?, email?, phone? }
 */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $isCustomer = $this->resource instanceof Customer;

        return [
            'id' => (string) $this->id,
            'displayName' => $this->display_name ?? $this->name,
            'lineId' => $isCustomer ? $this->line_user_id : $this->line_id,
            'avatarUrl' => $isCustomer ? $this->picture_url : null,
            'email' => $this->email,
            'phone' => $this->phone,
        ];
    }
}
