<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * A sport type, platform-wide.
 *
 * Not scoped to an organization on purpose: the emoji and colour belong to the
 * sport, not to the venue that rents it, and letting each venue set its own
 * would mean five hundred definitions of แบดมินตัน. A venue chooses WHICH of
 * these it offers (`branches.sports`, `courts.sport`); the platform decides
 * what each one looks like.
 */
class Sport extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'sort_order' => 'integer'];
    }

    /** Offered in the pickers. Existing data keeps working either way. */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('sort_order')->orderBy('name');
    }

    /**
     * The shape every screen that draws a sport needs, and nothing more.
     *
     * The loader and the notification icon used to carry their own copy of
     * this; they read it off the venue payload now, so a sport added in the
     * admin screen appears without a deploy.
     */
    public function toMeta(): array
    {
        return [
            'key' => $this->key,
            'name' => $this->name,
            'emoji' => $this->emoji,
            'color' => $this->color,
        ];
    }
}
