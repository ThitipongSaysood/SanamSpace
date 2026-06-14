<?php

namespace App\Providers;

use App\Models\PlatformSetting;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

/**
 * Applies platform configuration stored in the database (platform_settings)
 * on top of the .env defaults at boot. This is what lets Super Admin manage
 * SMTP and other settings from the UI and have them take effect at runtime —
 * the database is the source of truth, .env only the bootstrap fallback.
 *
 * Heavily guarded: during migrations/tests the table may not exist yet, and a
 * legacy/plaintext encrypted column could throw — in either case we silently
 * fall back to the .env-provided config.
 */
class PlatformConfigServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        try {
            if (! Schema::hasTable('platform_settings')) {
                return;
            }

            $s = PlatformSetting::query()->first();
            if (! $s) {
                return;
            }

            $this->applyMail($s);

            // Security: token lifetime (minutes). 0/null = never expires.
            if ((int) $s->session_timeout_minutes > 0) {
                config(['sanctum.expiration' => (int) $s->session_timeout_minutes]);
            }
        } catch (\Throwable $e) {
            // Keep booting with .env config; never let settings break the app.
        }
    }

    private function applyMail(PlatformSetting $s): void
    {
        $mailer = $s->mail_mailer ?: 'log';
        config(['mail.default' => $mailer]);

        if ($mailer === 'smtp' && $s->mail_host) {
            config([
                'mail.mailers.smtp.host' => $s->mail_host,
                'mail.mailers.smtp.port' => (int) ($s->mail_port ?: 587),
                'mail.mailers.smtp.username' => $s->mail_username,
                'mail.mailers.smtp.password' => $s->mail_password, // decrypted by the model cast
                'mail.mailers.smtp.encryption' => $s->mail_encryption ?: 'tls',
            ]);
        }

        if ($s->mail_from_address) {
            config([
                'mail.from.address' => $s->mail_from_address,
                'mail.from.name' => $s->mail_from_name ?: config('mail.from.name'),
            ]);
        }
    }
}
