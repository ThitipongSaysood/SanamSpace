<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\PlatformSettingResource;
use App\Models\PlatformSetting;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    /** camelCase request field => DB column. */
    private const MAP = [
        'platformName' => 'platform_name',
        'supportEmail' => 'support_email',
        'timezone' => 'timezone',
        'currency' => 'currency',
        'dateFormat' => 'date_format',
        'language' => 'language',
        'mailMailer' => 'mail_mailer',
        'mailHost' => 'mail_host',
        'mailPort' => 'mail_port',
        'mailUsername' => 'mail_username',
        'mailEncryption' => 'mail_encryption',
        'mailFromAddress' => 'mail_from_address',
        'mailFromName' => 'mail_from_name',
        'promptpayId' => 'promptpay_id',
        'bankName' => 'bank_name',
        'bankAccountName' => 'bank_account_name',
        'bankAccountNumber' => 'bank_account_number',
    ];

    public function show(): PlatformSettingResource
    {
        return new PlatformSettingResource(PlatformSetting::query()->firstOrCreate([]));
    }

    public function update(Request $request): PlatformSettingResource
    {
        $validated = $request->validate([
            'platformName' => ['sometimes', 'string', 'max:255'],
            'supportEmail' => ['sometimes', 'nullable', 'email', 'max:255'],
            'timezone' => ['sometimes', 'string', 'max:100'],
            'currency' => ['sometimes', 'string', 'max:10'],
            'dateFormat' => ['sometimes', 'string', 'max:30'],
            'language' => ['sometimes', 'string', 'max:10'],

            // --- Mail / SMTP ---
            'mailMailer' => ['sometimes', 'string', 'in:log,smtp,sendmail'],
            'mailHost' => ['sometimes', 'nullable', 'string', 'max:255'],
            'mailPort' => ['sometimes', 'nullable', 'string', 'max:10'],
            'mailUsername' => ['sometimes', 'nullable', 'string', 'max:255'],
            'mailPassword' => ['sometimes', 'nullable', 'string', 'max:255'],
            'mailEncryption' => ['sometimes', 'nullable', 'string', 'in:tls,ssl'],
            'mailFromAddress' => ['sometimes', 'nullable', 'email', 'max:255'],
            'mailFromName' => ['sometimes', 'nullable', 'string', 'max:255'],

            // --- Platform billing payment ---
            'promptpayId' => ['sometimes', 'nullable', 'string', 'max:50'],
            'bankName' => ['sometimes', 'nullable', 'string', 'max:100'],
            'bankAccountName' => ['sometimes', 'nullable', 'string', 'max:255'],
            'bankAccountNumber' => ['sometimes', 'nullable', 'string', 'max:50'],
        ]);

        $setting = PlatformSetting::query()->firstOrCreate([]);

        $updates = [];
        foreach (self::MAP as $field => $column) {
            if (array_key_exists($field, $validated)) {
                $updates[$column] = $validated[$field];
            }
        }

        // The SMTP password only changes when a non-empty value is submitted,
        // so leaving the field blank in the UI keeps the existing password.
        if ($request->filled('mailPassword')) {
            $updates['mail_password'] = $validated['mailPassword'];
        }

        if ($updates) {
            $setting->update($updates);
        }

        return new PlatformSettingResource($setting->fresh());
    }
}
