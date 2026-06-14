<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class PlatformSetting extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected $casts = [
        // SMTP password is stored encrypted at rest (Laravel encrypts on write, decrypts on read).
        'mail_password' => 'encrypted',
        'session_timeout_minutes' => 'integer',
        'password_min_length' => 'integer',
        'two_factor_required' => 'boolean',
        'notify_new_org' => 'boolean',
        'notify_payment' => 'boolean',
        'notify_subscription_expiring' => 'boolean',
        'notify_support_ticket' => 'boolean',
        'backup_retention_days' => 'integer',
    ];
}
