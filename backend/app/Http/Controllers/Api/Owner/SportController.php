<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\Sport;
use Illuminate\Http\JsonResponse;

/**
 * The sports a venue may choose from.
 *
 * Read-only: the catalogue is the platform's (see Admin\SportController). This
 * exists so the branch and court forms stop shipping their own hard-coded list
 * — the two of them disagreed with each other and with the app, which is how a
 * venue ended up able to name a sport on its branch that it could not create a
 * court for.
 */
class SportController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Sport::query()->active()->ordered()->get()->map->toMeta()->all(),
        ]);
    }
}
