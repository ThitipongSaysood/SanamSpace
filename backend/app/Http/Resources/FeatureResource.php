<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Platform feature view for the Super Admin API:
 * { id, code, name, planCodes[] }
 *
 * `planCodes` lists the codes of plans that enable this feature, available
 * when the `plans` relation is eager-loaded (filtered to enabled pivots).
 */
class FeatureResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'planCodes' => $this->whenLoaded(
                'plans',
                fn () => $this->plans
                    ->filter(fn ($plan) => (int) $plan->pivot->enabled === 1)
                    ->pluck('code')
                    ->values()
                    ->all(),
                [],
            ),
        ];
    }
}
