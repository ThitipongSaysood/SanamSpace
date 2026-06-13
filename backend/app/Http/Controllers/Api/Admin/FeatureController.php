<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\FeatureResource;
use App\Models\Feature;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

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
}
