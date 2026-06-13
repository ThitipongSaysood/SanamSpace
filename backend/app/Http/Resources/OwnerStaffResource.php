<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Owner-portal view of an organization staff member (OrganizationUser joined
 * to its User + Role).
 *
 * Shape: { id(userId), displayName, email, roleName, status, joinedAt }
 *
 * `id` is the underlying user id (not the pivot id). `displayName` prefers the
 * membership display name, falling back to the user's. Expects the `user` and
 * `role` relations to be loaded.
 */
class OwnerStaffResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->user_id,
            'displayName' => $this->display_name ?? $this->user?->display_name,
            'email' => $this->user?->email,
            'roleName' => $this->role?->name,
            'status' => $this->status,
            'joinedAt' => $this->joined_at,
        ];
    }
}
