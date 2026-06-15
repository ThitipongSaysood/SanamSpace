<?php

namespace App\Services;

use App\Models\OrganizationSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

/**
 * Verifies a LINE LIFF id_token against LINE's verification endpoint and
 * returns the trusted profile claims. This is the security boundary for
 * customer login: the lineUserId comes from the verified `sub`, never from
 * raw client input.
 *
 * Per-venue aware: the resolved organization's LINE channel is used first,
 * falling back to the global `services.line.*` (.env) config.
 *
 * @see https://developers.line.biz/en/reference/line-login/#verify-id-token
 */
class LineTokenVerifier
{
    /**
     * True when a LINE channel is configured (real verification is enforced) —
     * either on the given org's settings or globally via .env.
     */
    public function isConfigured(?OrganizationSetting $settings = null): bool
    {
        return (bool) ($settings?->line_channel_id ?: config('services.line.channel_id'));
    }

    /**
     * Verify an id_token and return normalised claims:
     * ['lineUserId', 'displayName', 'pictureUrl', 'email'].
     *
     * The channel id is resolved from the org's settings first, then the global
     * .env config. (The channel_secret is NOT needed to verify an id_token.)
     *
     * @throws ValidationException when the token is missing or fails verification.
     */
    public function verify(?string $idToken, ?OrganizationSetting $settings = null): array
    {
        $channelId = (string) ($settings?->line_channel_id ?: config('services.line.channel_id'));

        if (! $idToken) {
            throw ValidationException::withMessages([
                'idToken' => 'LINE id token is required.',
            ]);
        }

        $response = Http::asForm()->post(config('services.line.verify_url'), [
            'id_token' => $idToken,
            'client_id' => $channelId,
        ]);

        if (! $response->successful()) {
            throw ValidationException::withMessages([
                'idToken' => 'LINE token verification failed.',
            ]);
        }

        $claims = $response->json();

        // Defence in depth: the audience must be our channel.
        if (! is_array($claims) || ($claims['aud'] ?? null) !== $channelId || empty($claims['sub'])) {
            throw ValidationException::withMessages([
                'idToken' => 'LINE token is not valid for this channel.',
            ]);
        }

        return [
            'lineUserId' => (string) $claims['sub'],
            'displayName' => $claims['name'] ?? null,
            'pictureUrl' => $claims['picture'] ?? null,
            'email' => $claims['email'] ?? null,
        ];
    }
}
