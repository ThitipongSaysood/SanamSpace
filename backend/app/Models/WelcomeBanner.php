<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * One announcement card a venue shows its own customers.
 *
 * A venue may keep several — a holiday notice, a promotion, an opening-hours
 * change — and switch each on or off without deleting it.
 */
class WelcomeBanner extends Model
{
    use HasUuids, BelongsToOrganization;

    protected $guarded = [];

    protected $casts = [
        'is_active' => 'boolean',
        'popup' => 'boolean',
        'sort_order' => 'integer',
    ];

    /** Banners the customer app should show, topmost first. */
    public function scopeVisible(Builder $query): Builder
    {
        return $query->where('is_active', true)->orderBy('sort_order')->orderBy('created_at');
    }

    /** A banner with nothing in it has nothing to show. */
    public function hasContent(): bool
    {
        return filled($this->title) || filled($this->message) || filled($this->image_url);
    }
}
