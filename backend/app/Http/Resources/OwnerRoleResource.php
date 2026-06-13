<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Owner-portal view of an org-available Role.
 *
 * Shape: { id, name, isSystemRole }
 */
class OwnerRoleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'isSystemRole' => (bool) $this->is_system_role,
        ];
    }
}
