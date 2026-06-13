<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Maps a generated schedule payload to the frontend `CourtSchedule` shape:
 * { courtId, date, slots: [{ start, end, status }] }
 *
 * The underlying resource is an array produced by CourtScheduleService.
 */
class CourtScheduleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'courtId' => $this->resource['courtId'],
            'date' => $this->resource['date'],
            'slots' => $this->resource['slots'],
        ];
    }
}
