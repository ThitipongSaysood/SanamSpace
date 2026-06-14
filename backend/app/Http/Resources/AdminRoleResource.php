<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdminRoleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'isSystemRole' => (bool) $this->is_system_role,
            'scope' => $this->organization_id ? 'องค์กร' : 'ระบบ',
            'permissionCount' => (int) ($this->permissions_count ?? 0),
        ];
    }
}
