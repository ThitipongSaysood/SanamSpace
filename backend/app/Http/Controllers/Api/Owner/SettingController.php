<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerSettingResource;
use App\Models\Organization;
use App\Models\OrganizationSetting;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    /**
     * GET /owner/settings
     *
     * The current org's OrganizationSetting plus the org name, as a single
     * settings object. A settings row is created on demand if missing so the
     * owner always gets an editable shape back.
     */
    public function show(Request $request): OwnerSettingResource
    {
        $org = $this->currentOrganization($request);

        return new OwnerSettingResource($this->settingsFor($org));
    }

    /**
     * PUT /owner/settings
     *
     * Validate + update the editable settings fields on the org's
     * OrganizationSetting (and the org name when provided). Returns the
     * updated settings object.
     */
    public function update(Request $request): OwnerSettingResource
    {
        $org = $this->currentOrganization($request);
        $setting = $this->settingsFor($org);

        $validated = $request->validate([
            'orgName' => ['sometimes', 'string', 'max:255'],
            'logoText' => ['sometimes', 'nullable', 'string', 'max:255'],
            'logoUrl' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'address' => ['sometimes', 'nullable', 'string'],

            // --- Billing identity (buyer block on invoices/receipts) ---
            'taxId' => ['sometimes', 'nullable', 'string', 'max:20'],
            'billingName' => ['sometimes', 'nullable', 'string', 'max:255'],
            'billingAddress' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'billingBranch' => ['sometimes', 'nullable', 'string', 'max:100'],
            'googleMapUrl' => ['sometimes', 'nullable', 'string'],
            'lineOaUrl' => ['sometimes', 'nullable', 'string'],
            'primaryColor' => ['sometimes', 'nullable', 'string', 'max:20'],
            'secondaryColor' => ['sometimes', 'nullable', 'string', 'max:20'],
            'accentColor' => ['sometimes', 'nullable', 'string', 'max:20'],
            'fontFamily' => ['sometimes', 'nullable', 'string', 'max:100'],
            'timezone' => ['sometimes', 'string', 'max:100'],
            'checkinEnabled' => ['sometimes', 'boolean'],
            // Deposits: hold the slot for part of the money, take the rest at
            // the desk. `percent` is a share of the booking, `fixed` a flat baht.
            'depositEnabled' => ['sometimes', 'boolean'],
            'depositType' => ['sometimes', 'in:percent,fixed'],
            'depositValue' => ['sometimes', 'numeric', 'min:0', 'max:100000'],
            // { "Gold": 10, "Platinum": 15 } — a standing rate per tier.
            'memberDiscounts' => ['sometimes', 'nullable', 'array'],
            'memberDiscounts.*' => ['numeric', 'min:0', 'max:100'],
            // Points: a flat number per booking, and the ladder tiers are
            // judged on. Tier names must match `memberDiscounts`.
            'pointsEnabled' => ['sometimes', 'boolean'],
            'pointsPerBooking' => ['sometimes', 'integer', 'min:0', 'max:10000'],
            'tierThresholds' => ['sometimes', 'nullable', 'array'],
            'tierThresholds.*' => ['integer', 'min:0'],

            // --- Payment (where this venue receives booking money) ---
            'promptpayId' => ['sometimes', 'nullable', 'string', 'max:50'],
            'promptpayName' => ['sometimes', 'nullable', 'string', 'max:255'],
            'bankName' => ['sometimes', 'nullable', 'string', 'max:100'],
            'bankAccountName' => ['sometimes', 'nullable', 'string', 'max:255'],
            'bankAccountNumber' => ['sometimes', 'nullable', 'string', 'max:50'],

            // --- LINE (per-venue integration) ---
            // channelId / liffId are plain identifiers; the two secrets are
            // WRITE-ONLY (handled below) and never returned by the resource.
            'lineChannelId' => ['sometimes', 'nullable', 'string', 'max:255'],
            'lineLiffId' => ['sometimes', 'nullable', 'string', 'max:255'],
            'lineChannelSecret' => ['sometimes', 'nullable', 'string', 'max:500'],
            'lineMessagingToken' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ]);

        // Org name lives on the organization, not the settings row.
        if (array_key_exists('orgName', $validated)) {
            $org->update(['name' => $validated['orgName']]);
        }

        // Map the camelCase API fields onto the settings columns.
        $columnMap = [
            'logoText' => 'logo',
            'logoUrl' => 'logo_url',
            'phone' => 'phone',
            'email' => 'email',
            'address' => 'address',
            // Billing identity — the buyer block on invoices/receipts.
            'taxId' => 'tax_id',
            'billingName' => 'billing_name',
            'billingAddress' => 'billing_address',
            'billingBranch' => 'billing_branch',
            'googleMapUrl' => 'google_map_url',
            'lineOaUrl' => 'line_oa_url',
            'primaryColor' => 'primary_color',
            'secondaryColor' => 'secondary_color',
            'accentColor' => 'accent_color',
            'fontFamily' => 'font_family',
            'timezone' => 'timezone',
            'checkinEnabled' => 'checkin_enabled',
            'depositEnabled' => 'deposit_enabled',
            'depositType' => 'deposit_type',
            'depositValue' => 'deposit_value',
            'memberDiscounts' => 'member_discounts',
            'pointsEnabled' => 'points_enabled',
            'pointsPerBooking' => 'points_per_booking',
            'tierThresholds' => 'tier_thresholds',
            'promptpayId' => 'promptpay_id',
            'promptpayName' => 'promptpay_name',
            'bankName' => 'bank_name',
            'bankAccountName' => 'bank_account_name',
            'bankAccountNumber' => 'bank_account_number',
            // LINE plain identifiers (the secrets are handled separately below).
            'lineChannelId' => 'line_channel_id',
            'lineLiffId' => 'line_liff_id',
        ];

        $updates = [];
        foreach ($columnMap as $field => $column) {
            if (array_key_exists($field, $validated)) {
                $updates[$column] = $validated[$field];
            }
        }

        // LINE secrets are write-only: only persist when a non-empty value is
        // submitted, so a blank submit never wipes an existing stored secret.
        $secretMap = [
            'lineChannelSecret' => 'line_channel_secret',
            'lineMessagingToken' => 'line_messaging_token',
        ];
        foreach ($secretMap as $field => $column) {
            if (array_key_exists($field, $validated) && filled($validated[$field])) {
                $updates[$column] = $validated[$field];
            }
        }

        if ($updates) {
            $setting->update($updates);
        }

        return new OwnerSettingResource($this->settingsFor($org->fresh()));
    }

    /**
     * Resolve the current org from the request attribute set by owner.org.
     */
    private function currentOrganization(Request $request): Organization
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        return Organization::query()->findOrFail($orgId);
    }

    /**
     * The org's settings row (creating an empty one on demand) with its
     * `organization` relation loaded for the resource's orgName.
     */
    private function settingsFor(Organization $org): OrganizationSetting
    {
        $setting = OrganizationSetting::query()
            ->firstOrCreate(['organization_id' => $org->id]);

        $setting->setRelation('organization', $org);

        return $setting;
    }
}
