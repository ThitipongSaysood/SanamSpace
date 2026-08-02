<?php

namespace App\Http\Controllers\Api\Concerns;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * A bounded page for lists that grow without limit.
 *
 * Bookings, payments and invoices accumulate for as long as a venue trades, and
 * these endpoints used to return every row ever created — one owner's booking
 * list was already 1.1 MB on a demo dataset and climbing. A page cap keeps the
 * response flat no matter how long the venue has been running.
 *
 * The response shape stays `{ data: [...] }` with pagination in `meta`, so
 * existing callers keep working and only gain the ability to ask for more.
 */
trait PaginatesLists
{
    /** Enough to fill a screen without a second request. */
    private const DEFAULT_PER_PAGE = 50;

    /** A ceiling so one caller cannot ask for the whole table back. */
    private const MAX_PER_PAGE = 200;

    protected function paginated(Builder $query, Request $request): LengthAwarePaginator
    {
        $perPage = (int) $request->query('perPage', (string) self::DEFAULT_PER_PAGE);
        $perPage = max(1, min($perPage, self::MAX_PER_PAGE));

        return $query->paginate($perPage)->withQueryString();
    }
}
