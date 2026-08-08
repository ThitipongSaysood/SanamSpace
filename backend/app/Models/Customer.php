<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class Customer extends Authenticatable
{
    use BelongsToOrganization, HasApiTokens, HasUuids, SoftDeletes;

    protected $guarded = [];

    protected $hidden = ['remember_token'];

    protected function casts(): array
    {
        return [
            'total_spending' => 'float',
            'visits' => 'integer',
            'marketing_consent' => 'boolean',
            'consent_at' => 'datetime',
            'unsubscribed_at' => 'datetime',
        ];
    }

    /**
     * Customers a marketing message may still be sent to.
     *
     * The one place suppression is expressed, so a new audience cannot forget
     * it. Opting out is the hard rule; `marketing_consent` is recorded but not
     * required here, because customers who predate the consent screen have
     * `null` and silencing them would be a business decision this scope does
     * not make. See the migration for why the two are separate.
     */
    public function scopeMarketingReachable(Builder $query): Builder
    {
        return $query->whereNull('unsubscribed_at');
    }

    /** Has this person opted out of marketing? */
    public function isUnsubscribed(): bool
    {
        return $this->unsubscribed_at !== null;
    }

    public function lineProfiles(): HasMany
    {
        return $this->hasMany(LineProfile::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function membership(): HasOne
    {
        return $this->hasOne(Membership::class);
    }

    public function wallet(): HasOne
    {
        return $this->hasOne(Wallet::class);
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }
}
