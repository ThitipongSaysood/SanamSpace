<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\PlanResource;
use App\Models\Plan;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class PlanController extends Controller
{
    /**
     * GET /admin/plans — all plans with limits + enabled feature codes.
     */
    public function index(): AnonymousResourceCollection
    {
        $plans = Plan::query()
            ->with('enabledFeatures')
            ->orderBy('price')
            ->get();

        return PlanResource::collection($plans);
    }

    /**
     * POST /admin/plans — create a plan (name/price/limits/is_active). Simple.
     */
    public function store(Request $request): PlanResource
    {
        $data = $this->validatePlan($request, creating: true);

        $plan = Plan::create($data);

        return new PlanResource($plan->load('enabledFeatures'));
    }

    /**
     * PUT /admin/plans/{id}/features — set which features are enabled for a plan.
     */
    public function updateFeatures(Request $request, string $id): PlanResource
    {
        $data = $request->validate([
            'featureIds' => ['present', 'array'],
            'featureIds.*' => ['string', Rule::exists('features', 'id')],
        ]);

        $plan = Plan::findOrFail($id);
        $sync = collect($data['featureIds'])->mapWithKeys(fn ($fid) => [$fid => ['enabled' => 1]])->all();
        $plan->features()->sync($sync);

        return new PlanResource($plan->load('enabledFeatures'));
    }

    /**
     * PUT /admin/plans/{id} — update a plan (name/price/limits/is_active).
     */
    public function update(Request $request, string $id): PlanResource
    {
        $plan = Plan::findOrFail($id);

        $plan->update($this->validatePlan($request, creating: false));

        return new PlanResource($plan->load('enabledFeatures'));
    }

    /**
     * Validate + map the (camelCase) request payload to plan columns.
     * On update every field is optional; on create code/name are required.
     */
    private function validatePlan(Request $request, bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        $validated = $request->validate([
            'code' => [$creating ? 'required' : 'sometimes', 'string', 'max:100'],
            'name' => [$required, 'string', 'max:255'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'interval' => ['sometimes', 'string', 'max:50'],
            'branchLimit' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'courtLimit' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'staffLimit' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'monthlyBookingLimit' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'storageGb' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'isActive' => ['sometimes', 'boolean'],
        ]);

        $map = [
            'branchLimit' => 'branch_limit',
            'courtLimit' => 'court_limit',
            'staffLimit' => 'staff_limit',
            'monthlyBookingLimit' => 'monthly_booking_limit',
            'storageGb' => 'storage_gb',
            'isActive' => 'is_active',
        ];

        $attributes = [];
        foreach ($validated as $key => $value) {
            $attributes[$map[$key] ?? $key] = $value;
        }

        return $attributes;
    }
}
