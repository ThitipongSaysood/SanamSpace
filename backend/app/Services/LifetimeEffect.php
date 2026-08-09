<?php

namespace App\Services;

/**
 * What a points movement does to the lifetime total a TIER is judged on.
 *
 * The balance and the ladder are not the same number, and two of these look
 * identical from the balance's side while meaning opposite things:
 *
 * - `Earned`   — new value. Counts toward the ladder.
 * - `Spent`    — the customer used what they earned. The ladder does NOT move;
 *                reaching Gold and then spending must not demote anyone.
 * - `Reversed` — the points turned out not to exist (a cancelled booking). The
 *                ladder forgets them, because they were never really earned.
 */
enum LifetimeEffect
{
    case Earned;
    case Spent;
    case Reversed;
}
