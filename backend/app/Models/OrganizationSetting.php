<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class OrganizationSetting extends Model
{
    use HasUuids, BelongsToOrganization;

    protected $guarded = [];
}
