<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Owner-portal view of an OrganizationSetting plus its org name.
 *
 * Shape:
 * {
 *   orgName, orgSlug, logoText, phone, email, address, googleMapUrl, lineOaUrl,
 *   primaryColor, secondaryColor, accentColor, fontFamily, timezone
 * }
 *
 * The `logoText` field is backed by the `logo` column; `orgName` comes from
 * the loaded `organization` relation.
 */
class OwnerSettingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'orgName' => $this->organization?->name,
            // Read-only: the slug is this venue's address (/v/{slug}), so the
            // owner portal can show the link they hand to their customers.
            // Renaming the venue must not change it — old links would break.
            'orgSlug' => $this->organization?->slug,
            'logoText' => $this->logo,
            // Greeting shown to this venue's customers on their home screen.
            // Billing identity — what appears as the buyer on a tax invoice.
            'taxId' => $this->tax_id,
            'billingName' => $this->billing_name,
            'billingAddress' => $this->billing_address,
            'billingBranch' => $this->billing_branch,
            'logoUrl' => $this->logo_url,
            // The venue's own login screen (/v/{slug}): its photo behind the
            // sign-in card, and the line of copy under the heading. Both empty
            // is a supported state — the app falls back to the court of the
            // sport this venue rents and to a sentence built from its name.
            'loginCoverUrl' => $this->login_cover_url,
            'loginTagline' => $this->login_tagline,
            'phone' => $this->phone,
            'email' => $this->email,
            'address' => $this->address,
            'googleMapUrl' => $this->google_map_url,
            'lineOaUrl' => $this->line_oa_url,
            'primaryColor' => $this->primary_color,
            'secondaryColor' => $this->secondary_color,
            'accentColor' => $this->accent_color,
            'fontFamily' => $this->font_family,
            'timezone' => $this->timezone,
            'checkinEnabled' => (bool) ($this->checkin_enabled ?? true),
            'slipVerifyMode' => $this->slip_verify_mode ?: 'manual',
            'depositEnabled' => (bool) ($this->deposit_enabled ?? false),
            'depositType' => $this->deposit_type ?? 'percent',
            'depositValue' => (float) ($this->deposit_value ?? 0),
            'memberDiscounts' => $this->member_discounts ?? null,
            'pointsEnabled' => (bool) ($this->points_enabled ?? false),
            'pointsPerBooking' => (int) ($this->points_per_booking ?? 10),
            'tierThresholds' => $this->tier_thresholds ?? \App\Services\PointsService::DEFAULT_TIERS,
            'pointsExpiryEnabled' => (bool) ($this->points_expiry_enabled ?? false),
            'pointsValidMonths' => (int) ($this->points_valid_months ?? 12),
            'pointsExpiryWarnDays' => (int) ($this->points_expiry_warn_days ?? 14),
            'selfRedeemEnabled' => (bool) ($this->self_redeem_enabled ?? false),
            'redeemCollectHours' => (int) ($this->redeem_collect_hours ?? 48),
            // Payment (where this venue receives booking money)
            'promptpayId' => $this->promptpay_id,
            'promptpayName' => $this->promptpay_name,
            'bankName' => $this->bank_name,
            'bankAccountName' => $this->bank_account_name,
            'bankAccountNumber' => $this->bank_account_number,
            // LINE (per-venue). Secrets are WRITE-ONLY: expose only a "*Set"
            // boolean, never the encrypted channel secret / messaging token.
            'lineChannelId' => $this->line_channel_id,
            'lineLiffId' => $this->line_liff_id,
            'lineChannelSecretSet' => filled($this->line_channel_secret),
            'lineMessagingTokenSet' => filled($this->line_messaging_token),
        ];
    }
}
