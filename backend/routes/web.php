<?php

use Illuminate\Support\Facades\Route;

// This is an API-only backend. The root returns service info; the actual
// customer/owner apps are the Next.js frontend. Real endpoints live under /api/v1.
Route::get('/', function () {
    return response()->json([
        'name' => 'SanamSpace API',
        'description' => 'White-label multi-tenant sports venue booking SaaS',
        'status' => 'ok',
        'version' => 'v1',
        'api_base' => url('/api/v1'),
        'health' => url('/up'),
    ]);
});
