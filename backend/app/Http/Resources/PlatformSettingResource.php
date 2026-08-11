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

            // --- Slip verification (platform-level Slip2Go integration) ---
            // The key is write-only: only whether one is set is ever sent back.
            'slipVerifyEnabled' => (bool) $this->slip_verify_enabled,
            'slipVerifyDriver' => $this->slip_verify_driver ?: 'null',
            'slipVerifyEndpoint' => $this->slip_verify_endpoint,
            'slipVerifyKeySet' => filled($this->slip_verify_key),

            // --- Platform billing payment details ---
            'companyName' => $this->company_name,
            'taxId' => $this->tax_id,
            'companyAddress' => $this->company_address,
            'vatEnabled' => (bool) $this->vat_enabled,
            'vatRate' => (float) $this->vat_rate,
            'promptpayId' => $this->promptpay_id,
            'promptpayName' => $this->promptpay_name,
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
