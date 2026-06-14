<?php
namespace App\Http\Resources;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
class AdminSupportTicketResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'ticketNo' => $this->ticket_no,
            'organizationName' => $this->organization_name,
            'subject' => $this->subject,
            'status' => $this->status,
            'priority' => $this->priority,
            'assignedTo' => $this->assigned_to,
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
