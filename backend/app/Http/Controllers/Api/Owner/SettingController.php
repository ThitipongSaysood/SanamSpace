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
            'googleMapUrl' => ['sometimes', 'nullable', 'string'],
            'lineOaUrl' => ['sometimes', 'nullable', 'string'],
            'primaryColor' => ['sometimes', 'nullable', 'string', 'max:20'],
            'secondaryColor' => ['sometimes', 'nullable', 'string', 'max:20'],
            'accentColor' => ['sometimes', 'nullable', 'string', 'max:20'],
            'fontFamily' => ['sometimes', 'nullable', 'string', 'max:100'],
            'timezone' => ['sometimes', 'string', 'max:100'],
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
            'googleMapUrl' => 'google_map_url',
            'lineOaUrl' => 'line_oa_url',
            'primaryColor' => 'primary_color',
            'secondaryColor' => 'secondary_color',
            'accentColor' => 'accent_color',
            'fontFamily' => 'font_family',
            'timezone' => 'timezone',
        ];

        $updates = [];
        foreach ($columnMap as $field => $column) {
            if (array_key_exists($field, $validated)) {
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
