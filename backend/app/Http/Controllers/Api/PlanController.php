<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PlanResource;
use App\Models\Plan;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PlanController extends Controller
{
    /**
     * GET /plans — the public pricing catalogue for the marketing site.
     *
     * The landing page renders its cards from this, so a feature toggled in the
     * admin Feature Matrix (the plan_features pivot) appears or disappears on the
     * pricing page with no code change — the whole reason this endpoint exists.
     * Only active plans, cheapest first; each carries its limits and the codes of
     * the features it currently enables (pivot.enabled = 1).
     *
     * Public and unauthenticated: prices and what a plan includes are the first
     * thing a prospective venue reads, before it has any account or venue slug.
     */
    public function index(): AnonymousResourceCollection
    {
        $plans = Plan::query()
            ->with('enabledFeatures')
            ->where('is_active', true)
            ->orderBy('price')
            ->get();

        return PlanResource::collection($plans);
    }
}
