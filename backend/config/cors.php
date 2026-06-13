<?php

return [
    /*
     * CORS for the API. In production set CORS_ALLOWED_ORIGINS to the frontend
     * origin(s), comma-separated (e.g. https://app.example.com). When the
     * frontend is served same-origin behind the edge nginx, CORS is moot.
     */
    'paths' => ['api/*', 'up', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_filter(
        array_map('trim', explode(',', env('CORS_ALLOWED_ORIGINS', '*')))
    ),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    // Token (Bearer) auth — no cookies — so credentials are not required.
    'supports_credentials' => false,
];
