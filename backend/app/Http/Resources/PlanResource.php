<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Platform plan view for the Super Admin API:
 * { id, code, name, price, interval, limits{...}, isActive, featureCodes[] }
 *
 * `limits` mirrors the Feature Matrix; NULL limit = unlimited (∞).
 * `featureCodes` is the list of feature codes this plan enables (pivot.enabled = 1),
 * available when the `enabledFeatures` relation is eager-loaded.
 */
class PlanResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'price' => (float) $this->price,
            'interval' => $this->interval,
            'limits' => [
                'branchLimit' => $this->branch_limit,
                'courtLimit' => $this->court_limit,
                'staffLimit' => $this->staff_limit,
                'monthlyBookingLimit' => $this->monthly_booking_limit,
                'storageGb' => $this->storage_gb,
            ],
            'isActive' => (bool) $this->is_active,
            'featureCodes' => $this->whenLoaded(
                'enabledFeatures',
                fn () => $this->enabledFeatures->pluck('code')->values()->all(),
                [],
            ),
        ];
    }
}
