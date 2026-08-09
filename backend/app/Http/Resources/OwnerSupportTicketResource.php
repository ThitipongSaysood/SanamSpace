<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A support thread as the venue sees it.
 *
 * Separate from the admin resource rather than shared, for one field:
 * `assigned_to` is the name of whoever on the platform picked the ticket up.
 * That is a note the desk keeps for itself, and it is not the venue's business
 * which of us is handling their question.
 *
 * `emailed` is left out for the same reason — whether our reply also went out
 * by mail is our delivery problem, and the venue is already reading the reply.
 */
class OwnerSupportTicketResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'ticketNo' => $this->ticket_no,
            'subject' => $this->subject,
            'status' => $this->status,
            'priority' => $this->priority,
            'body' => $this->body,
            'resolvedAt' => $this->resolved_at?->toIso8601String(),
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
            'replies' => $this->whenLoaded('replies', fn () => $this->replies->map(fn ($r) => [
                'id' => (string) $r->id,
                'authorName' => $r->author_name,
                'authorSide' => $r->author_side,
                'body' => $r->body,
                'createdAt' => $r->created_at?->toIso8601String(),
            ])->all(), []),
        ];
    }
}
