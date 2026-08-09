<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One reward handed over.
 *
 * Name and cost are snapshots — repricing a reward tomorrow must not rewrite
 * what last week's redemption cost.
 */
class RewardRedemption extends Model
{
    use BelongsToOrganization, HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['points_spent' => 'integer'];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function reward(): BelongsTo
    {
        return $this->belongsTo(Reward::class);
    }

    /** The staff member who handed it over. */
    public function staff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'redeemed_by');
    }
}
