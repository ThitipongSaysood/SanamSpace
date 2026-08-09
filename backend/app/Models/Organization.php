<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Organization extends Model
{
    use HasUuids, SoftDeletes;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'trial_start_at' => 'datetime',
            'trial_end_at' => 'datetime',
        ];
    }

    /**
     * Still inside a free trial.
     *
     * A past `trial_end_at` reads as "the trial is over", which is also how a
     * trial that converted is recorded — paying sets the end date to the day
     * the money arrived rather than clearing it, so when a venue started
     * trying the product survives its becoming a customer.
     */
    public function onTrial(): bool
    {
        return $this->trial_end_at !== null && $this->trial_end_at->isFuture();
    }

    public function settings(): HasOne
    {
        return $this->hasOne(OrganizationSetting::class);
    }

    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class);
    }

    /**
     * The announcements this venue is currently showing its customers, topmost
     * first. Switched-off banners are excluded here rather than at every call
     * site — the owner portal queries WelcomeBanner directly when it needs all
     * of them.
     */
    public function welcomeBanners(): HasMany
    {
        return $this->hasMany(WelcomeBanner::class)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('created_at');
    }

    public function courts(): HasMany
    {
        return $this->hasMany(Court::class);
    }

    public function customers(): HasMany
    {
        return $this->hasMany(Customer::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function organizationUsers(): HasMany
    {
        return $this->hasMany(OrganizationUser::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    /** The current/active subscription (latest active one, else latest). */
    public function activeSubscription(): HasOne
    {
        return $this->hasOne(Subscription::class)
            ->where('status', 'active')
            ->latestOfMany();
    }
}
