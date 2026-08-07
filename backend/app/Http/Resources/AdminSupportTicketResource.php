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
            'body' => $this->body,
            'resolvedAt' => $this->resolved_at?->toIso8601String(),
            'createdAt' => $this->created_at?->toIso8601String(),
            // The thread. `emailed` says whether the venue actually got it.
            'replies' => $this->whenLoaded('replies', fn () => $this->replies->map(fn ($r) => [
                'id' => (string) $r->id,
                'authorName' => $r->author_name,
                'authorSide' => $r->author_side,
                'body' => $r->body,
                'emailed' => (bool) $r->emailed,
                'createdAt' => $r->created_at?->toIso8601String(),
            ])->all(), []),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
