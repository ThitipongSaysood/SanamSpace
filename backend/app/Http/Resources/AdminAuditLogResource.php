<?php
namespace App\Http\Resources;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
class AdminAuditLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'userName' => $this->user_name,
            'action' => $this->action,
            'detail' => $this->detail,
            'ipAddress' => $this->ip_address,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
