<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Owner Portal — image upload for venue cover / gallery / floor-plan.
 * Stores on the public disk (served via the storage symlink at /storage/...)
 * and returns an absolute URL so it resolves both same-origin (prod) and
 * cross-origin (dev: Next on :3000 -> API on :8000).
 */
class UploadController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'image', 'max:5120'], // 5 MB
        ]);

        $path = $request->file('file')->store('venues', 'public');

        return response()->json([
            'url' => url('/storage/'.$path),
            'path' => $path,
        ]);
    }
}
