<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // LINE Login / LIFF. When `channel_id` is set the customer login flow
    // REQUIRES a verified id_token (checked against `verify_url`); when it is
    // blank the API falls back to the dev/test stub (trusts the supplied
    // lineUserId). `messaging_token` is the Messaging API push token; a venue's
    // own per-org token (organization_settings) takes precedence. `push_url` is
    // the multicast endpoint (see LineMessagingService).
    'line' => [
        'channel_id' => env('LINE_CHANNEL_ID'),
        'channel_secret' => env('LINE_CHANNEL_SECRET'),
        'messaging_token' => env('LINE_MESSAGING_TOKEN'),
        'verify_url' => env('LINE_VERIFY_URL', 'https://api.line.me/oauth2/v2.1/verify'),
        'push_url' => env('LINE_PUSH_URL', 'https://api.line.me/v2/bot/message/multicast'),
        'push_single_url' => env('LINE_PUSH_SINGLE_URL', 'https://api.line.me/v2/bot/message/push'),
        // Base URL of the customer app, used to build the {{bookingUrl}} deep
        // link inside a LINE receipt. Blank → the link (and its button) is
        // simply omitted, never broken.
        'customer_app_url' => env('CUSTOMER_APP_URL'),
    ],

    // Slip auto-verification provider (Phase 1). `null` = no external call, dedupe
    // only. A real driver (slip2go/slipok) reads key/endpoint here; slip2go
    // needs only the key (endpoint defaults to its documented QR URL).
    'slip' => [
        // Fallbacks only: admin normally sets these on the platform settings.
        'enabled' => env('SLIP_VERIFY_ENABLED', false),
        'driver' => env('SLIP_VERIFY_DRIVER', 'null'),
        'key' => env('SLIP_VERIFY_KEY'),
        'endpoint' => env('SLIP_VERIFY_ENDPOINT'),
    ],

];
