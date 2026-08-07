<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\WelcomeBanner;
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
        $org = Organization::where('slug', $slug)->with(['settings', 'welcomeBanners'])->firstOrFail();
        $s = $org->settings;

        return response()->json([
            'slug' => $org->slug,
            'name' => $org->name,
            'logoText' => $s?->logo ?: mb_strtoupper($org->name),
            'logoUrl' => $s?->logo_url,
            'liffId' => $s?->line_liff_id,
            // Everything the venue can edit in its own settings, so the
            // customer app reflects the change without a code deploy. Secondary
            // and accent used to stop here — the owner could pick them and
            // nothing downstream ever read them.
            'theme' => [
                'primary' => $s?->primary_color ?: '#16A34A',
                'secondary' => $s?->secondary_color ?: ($s?->primary_color ?: '#16A34A'),
                'accent' => $s?->accent_color ?: '#F59E0B',
                'warning' => '#F59E0B',
                'danger' => '#EF4444',
            ],
            'fontFamily' => $s?->font_family,
            // The venue's own announcements on the customer home, topmost first.
            // Only the ones it switched on, and only the ones with something in
            // them — an empty card is worse than no card.
            'welcomeBanners' => $org->welcomeBanners
                ->filter(fn (WelcomeBanner $b) => $b->hasContent())
                ->map(fn (WelcomeBanner $b) => [
                    'id' => (string) $b->id,
                    'title' => $b->title,
                    'message' => $b->message,
                    'imageUrl' => $b->image_url,
                    'link' => $b->link,
                    'popup' => $b->popup,
                ])
                ->values(),
            // A venue that does not scan should not show its customers a QR
            // nobody will ever look at.
            'checkinEnabled' => (bool) ($s?->checkin_enabled ?? true),
            'lineOaUrl' => $s?->line_oa_url,
            'phone' => $s?->phone,
        ]);
    }
}
