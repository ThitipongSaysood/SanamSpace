<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Owner-portal view of a Broadcast.
 *
 * Shape: { id, title, message, channel, status, recipientCount, sentAt, segmentName }
 *
 * `segmentName` is null when the broadcast targets the whole org (no segment).
 * Expects the `segment` relation to be loaded for segmentName.
 */
class OwnerBroadcastResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'title' => $this->title,
            'message' => $this->message,
            'channel' => $this->channel,
            'status' => $this->status,
            'recipientCount' => (int) $this->recipient_count,
            'sentAt' => $this->sent_at,
            'segmentName' => $this->segment?->name,
        ];
    }
}
