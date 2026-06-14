<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdminUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->display_name ?? $this->name,
            'email' => $this->email,
            'role' => $this->is_super_admin ? 'Super Admin' : 'Staff',
            'isSuperAdmin' => (bool) $this->is_super_admin,
            'status' => 'active',
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
