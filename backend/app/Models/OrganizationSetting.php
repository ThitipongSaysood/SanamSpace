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
        // { "Gold": 10 } — a standing discount rate per membership tier.
        'member_discounts' => 'array',
        'tier_thresholds' => 'array',
        'points_enabled' => 'boolean',
        'points_per_booking' => 'integer',
        'points_expiry_enabled' => 'boolean',
        'points_valid_months' => 'integer',
        'points_expiry_warn_days' => 'integer',
        'self_redeem_enabled' => 'boolean',
        'redeem_collect_hours' => 'integer',
    ];
}
