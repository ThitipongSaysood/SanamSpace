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
            // Which ones, so the editor can tick the right boxes.
            'permissionIds' => $this->whenLoaded(
                'permissions',
                fn () => $this->permissions->pluck('id')->map(fn ($id) => (string) $id)->all(),
                [],
            ),
            // owner/super_admin pass every check by design; the client greys the
            // editor out rather than offering a save that would be refused.
            'editable' => ! in_array($this->code, ['owner', 'super_admin'], true),
        ];
    }
}
