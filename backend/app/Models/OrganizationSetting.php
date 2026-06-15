<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class OrganizationSetting extends Model
{
    use HasUuids, BelongsToOrganization;

    protected $guarded = [];

    protected $casts = [
        // LINE secrets stored encrypted at rest (Laravel encrypts on write, decrypts on read).
        'line_channel_secret' => 'encrypted',
        'line_messaging_token' => 'encrypted',
    ];
}
