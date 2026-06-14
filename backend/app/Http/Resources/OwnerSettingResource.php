<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Owner-portal view of an OrganizationSetting plus its org name.
 *
 * Shape:
 * {
 *   orgName, logoText, phone, email, address, googleMapUrl, lineOaUrl,
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
            'logoText' => $this->logo,
            'logoUrl' => $this->logo_url,
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
        ];
    }
}
