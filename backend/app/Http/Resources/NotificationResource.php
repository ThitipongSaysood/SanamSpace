<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Maps a Notification to the frontend `AppNotification` shape (lib/types.ts):
 * { id, kind, title, body, timeAgo }
 *
 * timeAgo is stored as a pre-formatted Thai label (time_ago) so list output
 * matches the frontend fixtures exactly.
 */
class NotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'kind' => $this->kind,
            'title' => $this->title,
            'body' => $this->body,
            'imageUrl' => $this->image_url,
            'timeAgo' => $this->time_ago,
        ];
    }
}
