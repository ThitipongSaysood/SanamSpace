<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Maps a Promotion to the frontend `Promotion` shape (lib/types.ts):
 * { id, title, subtitle, tag }
 */
class PromotionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'title' => $this->title,
            'subtitle' => $this->subtitle,
            'tag' => $this->tag,
        ];
    }
}
