<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\FeatureResource;
use App\Models\Feature;
use App\Models\Plan;
use App\Support\PlanFeatures;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class FeatureController extends Controller
{
    /**
     * GET /admin/features — all features with the plan codes that enable each.
     */
    public function index(): AnonymousResourceCollection
    {
        $features = Feature::query()
            ->with('plans')
            ->orderBy('code')
            ->get();

        return FeatureResource::collection($features);
    }

    /**
     * PUT /admin/features/{id}/plans/{planId} — turn one cell of the matrix
     * on or off.
     *
     * A cell rather than a whole row or column, because that is how the grid is
     * read and how the decision is made: "does Business get the POS". Sending
     * the whole matrix back would make two operators editing different plans
     * overwrite each other.
     *
     * Takes effect on the venue's next request — nothing is cached beyond one.
     */
    public function setPlan(Request $request, string $id, string $planId): JsonResponse
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
        ]);

        $feature = Feature::findOrFail($id);
        $plan = Plan::findOrFail($planId);

        if ($data['enabled']) {
            DB::table('plan_features')->updateOrInsert(
                ['plan_id' => $plan->id, 'feature_id' => $feature->id],
                ['id' => (string) Str::uuid(), 'enabled' => 1, 'updated_at' => now(), 'created_at' => now()],
            );
        } else {
            DB::table('plan_features')
                ->where('plan_id', $plan->id)
                ->where('feature_id', $feature->id)
                ->delete();
        }

        // The resolver memoises per request; a venue must not keep the old
        // answer because the platform happened to change it mid-request.
        PlanFeatures::flush();

        return response()->json(['data' => [
            'featureId' => (string) $feature->id,
            'planId' => (string) $plan->id,
            'enabled' => (bool) $data['enabled'],
        ]]);
    }
}
