<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class Customer extends Authenticatable
{
    use HasUuids, HasApiTokens, SoftDeletes, BelongsToOrganization;

    protected $guarded = [];

    protected $hidden = ['remember_token'];

    protected function casts(): array
    {
        return [
            'total_spending' => 'float',
            'visits' => 'integer',
        ];
    }

    public function lineProfiles(): HasMany
    {
        return $this->hasMany(LineProfile::class);
    }
}
