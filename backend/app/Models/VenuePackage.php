<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class VenuePackage extends Model
{
    use HasUuids, SoftDeletes, BelongsToOrganization;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'hours' => 'integer',
            'price' => 'float',
            'valid_days' => 'integer',
            'save_percent' => 'integer',
        ];
    }
}
