<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Maps a VenuePackage to the frontend `VenuePackage` shape (lib/types.ts):
 * { id, name, hours, price, validDays, savePercent }
 */
class VenuePackageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'hours' => (int) $this->hours,
            'price' => (float) $this->price,
            'validDays' => (int) $this->valid_days,
            'savePercent' => (int) $this->save_percent,
        ];
    }
}
