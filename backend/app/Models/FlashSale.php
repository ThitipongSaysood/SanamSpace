<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A time-windowed court discount that applies itself — the venue's own flash
 * sale, not a code the customer types. See the create migration for the shape.
 */
class FlashSale extends Model
{
    use BelongsToOrganization, HasUuids, SoftDeletes;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'discount_value' => 'float',
            'max_discount' => 'float',
            'is_active' => 'boolean',
            'valid_days' => 'array',
            'starts_at' => 'date',
            'ends_at' => 'date',
        ];
    }

    public function scopes(): HasMany
    {
        return $this->hasMany(FlashSaleScope::class);
    }

    /** Whether it carries a WHEN condition (a flash sale essentially always does). */
    public function hasTimeCondition(): bool
    {
        return filled($this->valid_from_time) || filled($this->valid_to_time) || filled($this->valid_days);
    }

    /** "จ.–ศ. 13:00–16:00" — the window in the venue's own words. */
    public function conditionLabel(): ?string
    {
        if (! $this->hasTimeCondition()) {
            return null;
        }

        $names = [1 => 'จ.', 2 => 'อ.', 3 => 'พ.', 4 => 'พฤ.', 5 => 'ศ.', 6 => 'ส.', 7 => 'อา.'];
        $days = collect($this->valid_days ?? [])->sort()->map(fn ($d) => $names[(int) $d] ?? null)->filter();

        $when = $days->isEmpty() || $days->count() === 7 ? 'ทุกวัน' : $days->implode(' ');
        $from = $this->valid_from_time;
        $to = $this->valid_to_time;

        return match (true) {
            filled($from) && filled($to) => "{$when} {$from}–{$to}",
            filled($from) => "{$when} ตั้งแต่ {$from}",
            filled($to) => "{$when} ถึง {$to}",
            default => $when,
        };
    }

    /**
     * Does this sale apply to that court? No scope rows means the whole venue,
     * so "covers everything" is the empty case, not an exhaustive list.
     */
    public function coversCourt(Court $court): bool
    {
        $scopes = $this->relationLoaded('scopes') ? $this->scopes : $this->scopes()->get();

        if ($scopes->isEmpty()) {
            return true;
        }

        foreach ($scopes as $scope) {
            if ($scope->court_id !== null && $scope->court_id === $court->id) {
                return true;
            }
            if ($scope->branch_id !== null && $scope->branch_id === $court->branch_id) {
                return true;
            }
        }

        return false;
    }
}
