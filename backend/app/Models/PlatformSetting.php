<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class PlatformSetting extends Model
{
    use HasUuids;

    protected $guarded = [];

    // SMTP password is stored encrypted at rest (Laravel encrypts on write, decrypts on read).
    protected $casts = [
        'mail_password' => 'encrypted',
    ];
}
