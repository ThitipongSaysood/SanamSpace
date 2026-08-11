<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/** A discount code the venue hands out. Codes are stored and compared uppercase. */
class Coupon extends Model
{
    use BelongsToOrganization, HasUuids, SoftDeletes;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'value' => 'float',
            'min_amount' => 'float',
            'max_discount' => 'float',
            'usage_limit' => 'integer',
            'per_customer_limit' => 'integer',
            'used_count' => 'integer',
            'starts_at' => 'date',
            'ends_at' => 'date',
            'is_active' => 'boolean',
            'valid_days' => 'array',
        ];
    }

    /**
     * Whether this coupon carries a condition about WHEN the booking is.
     *
     * Asked by the discount service so a caller that cannot say when the
     * booking is gets refused rather than quietly given the discount — the
     * failure mode that let "จอง 07:00–16:00" come off a 20:00 booking.
     */
    public function hasTimeCondition(): bool
    {
        return filled($this->valid_from_time) || filled($this->valid_to_time) || filled($this->valid_days);
    }

    /** "ทุกวัน 07:00–16:00" — the condition in the venue's own words. */
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

    public function redemptions(): HasMany
    {
        return $this->hasMany(CouponRedemption::class);
    }

    /** Normalised on the way in, so nothing downstream has to remember to. */
    public function setCodeAttribute(string $value): void
    {
        $this->attributes['code'] = mb_strtoupper(trim($value));
    }
}
