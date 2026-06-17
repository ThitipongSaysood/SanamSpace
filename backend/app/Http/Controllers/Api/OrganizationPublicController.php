<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;

/**
 * Public, unauthenticated per-venue branding for the multi-tenant login page
 * (GET /orgs/{slug}/public). Drives the customer SPA's tenant resolution: the
 * venue's name, logo, theme colours, and LIFF id so /v/{slug} can render the
 * right brand and init the right LINE channel. NEVER exposes secrets
 * (channel_secret / messaging_token are intentionally omitted).
 */
class OrganizationPublicController extends Controller
{
    public function show(string $slug): JsonResponse
    {
        $org = Organization::where('slug', $slug)->firstOrFail();
        $s = $org->settings;

        return response()->json([
            'slug' => $org->slug,
            'name' => $org->name,
            'logoText' => $s?->logo ?: mb_strtoupper($org->name),
            'logoUrl' => $s?->logo_url,
            'liffId' => $s?->line_liff_id,
            'theme' => [
                'primary' => $s?->primary_color ?: '#16A34A',
                'warning' => '#F59E0B',
                'danger' => '#EF4444',
            ],
            'lineOaUrl' => $s?->line_oa_url,
            'phone' => $s?->phone,
        ]);
    }
}
