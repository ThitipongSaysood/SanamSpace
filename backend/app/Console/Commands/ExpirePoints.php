<?php

namespace App\Console\Commands;

use App\Models\Organization;
use App\Services\PointsService;
use Illuminate\Console\Command;

/**
 * Expire points that are due, and warn the ones that are close.
 *
 * Both halves live in one command because they are the same policy seen from
 * either side of a date, and a venue that runs the expiry without the warning
 * is taking value with no notice.
 *
 * Does nothing for a venue that has not switched expiry on.
 */
class ExpirePoints extends Command
{
    protected $signature = 'points:expire';

    protected $description = 'Expire due loyalty points and warn customers whose points are close to expiring';

    public function handle(PointsService $points): int
    {
        $expired = 0;
        $warned = 0;

        foreach (Organization::query()->pluck('id') as $orgId) {
            $warned += $points->warnExpiring($orgId);
            $expired += $points->expireDue($orgId);
        }

        $this->info("Points: expired {$expired} membership(s), warned {$warned}.");

        return self::SUCCESS;
    }
}
