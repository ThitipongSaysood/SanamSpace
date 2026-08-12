<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Maps a Branch (+ its organization settings & courts) to the frontend
 * `Venue` shape (lib/types.ts). Field names are camelCase to match 1:1.
 *
 * The public venue id is the organization slug so frontend
 * getVenue("everyday-badminton") works directly.
 */
class VenueResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $settings = $this->organization?->settings;

        // "from" price = cheapest court price at this branch.
        $minPrice = $this->courts->min('price_per_hour');

        return [
            'id' => $this->organization?->slug ?? $this->id,
            // The branch's own id, alongside the venue's.
            //
            // `id` is the organization slug — this app was built when a venue
            // was one branch, so the two were the same thing. They are not: a
            // venue with two branches returns two rows under one `id`, and
            // nothing downstream could tell them apart or ask for one of them.
            'branchId' => (string) $this->id,
            'name' => $this->name,
            'sports' => $this->sports ?? [],
            'rating' => (float) $this->rating,
            'reviewCount' => (int) $this->review_count,
            'openTime' => $this->formatTime($this->open_time),
            'closeTime' => $this->formatTime($this->close_time),
            'address' => $this->address,
            'imageUrl' => $this->image_url,
            'photos' => $this->photos ?? [],
            'planImageUrl' => $this->plan_image_url,
            'facilities' => $this->facilities ?? [],
            'pricePerHour' => $minPrice !== null ? (float) $minPrice : 0,
            'distanceKm' => (float) ($this->distance_km ?? 0),
            'phone' => $this->phone ?? $settings?->phone,
            'travelHint' => $this->travel_hint,
            'peakNote' => $this->peak_note,
            'description' => $this->description,
            'weekHours' => $this->week_hours,
        ];
    }

    private function formatTime(?string $time): ?string
    {
        if (! $time) {
            return null;
        }

        // Stored as "HH:MM:SS" -> return "HH:MM".
        return substr($time, 0, 5);
    }
}
