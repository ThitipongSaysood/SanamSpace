<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Maps a Court to the frontend `Court` shape (lib/types.ts).
 * venueId is the organization slug to match the Venue id.
 */
class CourtResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'venueId' => $this->branch?->organization?->slug ?? $this->branch_id,
            'name' => $this->name,
            'sport' => $this->sport,
            'pricePerHour' => (float) $this->price_per_hour,
            'spec' => $this->specArray(),
        ];
    }

    private function specArray(): ?array
    {
        // Only emit a spec object when at least one spec field is populated.
        $spec = [
            'sport' => $this->sportLabel(),
            'floor' => $this->floor,
            'aircon' => $this->aircon,
            'height' => $this->height,
            'lighting' => $this->lighting,
            'standard' => $this->standard,
            'players' => $this->players,
        ];

        $hasValue = collect($spec)->filter(fn ($v) => $v !== null && $v !== '')->isNotEmpty();

        return $hasValue ? $spec : null;
    }

    private function sportLabel(): ?string
    {
        return match ($this->sport) {
            'badminton' => 'แบดมินตัน',
            'futsal' => 'ฟุตซอล',
            'football' => 'ฟุตบอล',
            'tennis' => 'เทนนิส',
            default => $this->sport,
        };
    }
}
