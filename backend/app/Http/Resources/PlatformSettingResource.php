<?php
namespace App\Http\Resources;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
class PlatformSettingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'platformName' => $this->platform_name,
            'supportEmail' => $this->support_email,
            'timezone' => $this->timezone,
            'currency' => $this->currency,
            'dateFormat' => $this->date_format,
            'language' => $this->language,

            // --- Mail / SMTP (password never sent back; only whether one is set) ---
            'mailMailer' => $this->mail_mailer ?? 'log',
            'mailHost' => $this->mail_host,
            'mailPort' => $this->mail_port,
            'mailUsername' => $this->mail_username,
            'mailEncryption' => $this->mail_encryption,
            'mailFromAddress' => $this->mail_from_address,
            'mailFromName' => $this->mail_from_name,
            'mailPasswordSet' => filled($this->mail_password),

            // --- Platform billing payment details ---
            'promptpayId' => $this->promptpay_id,
            'bankName' => $this->bank_name,
            'bankAccountName' => $this->bank_account_name,
            'bankAccountNumber' => $this->bank_account_number,

            // --- Security ---
            'sessionTimeoutMinutes' => (int) $this->session_timeout_minutes,
            'passwordMinLength' => (int) ($this->password_min_length ?? 8),
            'twoFactorRequired' => (bool) $this->two_factor_required,

            // --- Notifications ---
            'notifyNewOrg' => (bool) $this->notify_new_org,
            'notifyPayment' => (bool) $this->notify_payment,
            'notifySubscriptionExpiring' => (bool) $this->notify_subscription_expiring,
            'notifySupportTicket' => (bool) $this->notify_support_ticket,

            // --- Backup ---
            'backupFrequency' => $this->backup_frequency ?? 'off',
            'backupRetentionDays' => (int) ($this->backup_retention_days ?? 30),
        ];
    }
}
