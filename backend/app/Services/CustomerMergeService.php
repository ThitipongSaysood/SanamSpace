<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Membership;
use App\Models\Wallet;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Two rows, one person.
 *
 * Duplicates are made at the counter: the same regular booked as a walk-in
 * every visit, or someone who paid in cash for months and then signed in with
 * LINE. Each row holds part of what they are owed — points here, credit there,
 * history split across both — so the customer can see none of it in one place
 * and staff cannot honour it.
 *
 * The rule this is built around: **nothing is deleted and nothing is
 * recalculated**. Every row that pointed at the duplicate is repointed at the
 * survivor, balances are added, and the duplicate is soft-deleted so the merge
 * itself stays undoable. A merge that recomputed a balance from scratch would
 * be a merge that could quietly disagree with the ledger.
 */
class CustomerMergeService
{
    /**
     * Everything a customer id can appear in.
     *
     * Kept as one list on purpose: a table missing here is data stranded on a
     * row nobody can reach. When a new table gains a `customer_id`, it belongs
     * in this list, and the test that walks the schema will say so if it does
     * not.
     */
    public const SIMPLE_TABLES = [
        'bookings',
        'payments',
        'refunds',
        'notifications',
        'customer_timeline',
        'customer_packages',
        'coupon_redemptions',
        'point_transactions',
        'reward_redemptions',
        'broadcast_recipients',
        'line_profiles',
    ];

    /**
     * @param  Customer  $keep  the row that survives — the customer's real record
     * @param  Customer  $merge  the duplicate, soft-deleted at the end
     */
    public function merge(Customer $keep, Customer $merge): Customer
    {
        if ($keep->id === $merge->id) {
            throw ValidationException::withMessages(['duplicateId' => 'เลือกลูกค้าคนเดียวกันสองครั้ง']);
        }

        // Never across venues. Two venues' customers are two customers even if
        // they are the same human being — their points are different debts.
        if ($keep->organization_id !== $merge->organization_id) {
            throw ValidationException::withMessages(['duplicateId' => 'รวมข้ามสนามไม่ได้']);
        }

        return DB::transaction(function () use ($keep, $merge) {
            foreach (self::SIMPLE_TABLES as $table) {
                DB::table($table)->where('customer_id', $merge->id)->update(['customer_id' => $keep->id]);
            }

            // Segments are a set: the same person cannot be in one twice, and
            // the unique index would refuse the move rather than dedupe it.
            $alreadyIn = DB::table('customer_segment_members')->where('customer_id', $keep->id)->pluck('segment_id');
            DB::table('customer_segment_members')
                ->where('customer_id', $merge->id)
                ->whereIn('segment_id', $alreadyIn)
                ->delete();
            DB::table('customer_segment_members')->where('customer_id', $merge->id)->update(['customer_id' => $keep->id]);

            $this->mergeWallets($keep, $merge);
            $this->mergeMemberships($keep, $merge);
            $this->fillBlanks($keep, $merge);

            $keep->save();

            // Soft delete: the row stays, so a merge done by mistake can be
            // read back and the ledger it left behind still names something.
            $merge->delete();

            app(TimelineRecorder::class)->record(
                $keep->organization_id,
                $keep->id,
                'note',
                'รวมข้อมูลลูกค้าซ้ำ',
                "รวมจาก {$merge->display_name} (".substr((string) $merge->id, 0, 8).')',
                now(),
            );

            return $keep->fresh();
        });
    }

    /**
     * Credit is money. It is added, and its history moves with it, so the
     * balance and the transactions that explain it stay consistent.
     */
    private function mergeWallets(Customer $keep, Customer $merge): void
    {
        $from = Wallet::query()->where('customer_id', $merge->id)->first();

        if (! $from) {
            return;
        }

        $to = Wallet::query()->where('customer_id', $keep->id)->first();

        if (! $to) {
            // Nothing to add to: the wallet simply changes hands, history and all.
            $from->update(['customer_id' => $keep->id]);

            return;
        }

        DB::table('wallet_transactions')->where('wallet_id', $from->id)->update(['wallet_id' => $to->id]);
        $to->increment('balance', (float) $from->balance);

        // Emptied with a plain query, not the model: see mergeMemberships for
        // why moving value must not look like losing it.
        DB::table('wallets')->where('id', $from->id)->update(['balance' => 0, 'deleted_at' => now()]);
    }

    /**
     * Points add up; lifetime points add up too, and the tier follows from
     * lifetime rather than being copied — otherwise merging two Silvers could
     * produce a Gold that neither of them earned, or keep a Silver who now has.
     */
    private function mergeMemberships(Customer $keep, Customer $merge): void
    {
        $from = Membership::query()->where('customer_id', $merge->id)->first();

        if (! $from) {
            return;
        }

        $to = Membership::query()->where('customer_id', $keep->id)->first();

        if (! $to) {
            $from->update(['customer_id' => $keep->id]);

            return;
        }

        $to->points = (int) $to->points + (int) $from->points;
        $to->lifetime_points = (int) $to->lifetime_points + (int) $from->lifetime_points;

        // Whichever card runs longer: a merge must not shorten what someone
        // already had.
        if ($from->expires_on && (! $to->expires_on || $from->expires_on->gt($to->expires_on))) {
            $to->expires_on = $from->expires_on;
        }

        // Saved through the model on purpose: the customer's balance really did
        // go up, and the timeline entry that fires is history worth keeping.
        $to->save();

        // The duplicate is emptied with a plain query so no observer fires.
        // Through the model it would write "แต้มสะสม -100" onto a timeline that
        // has already been moved — a record of points being taken away, on a
        // customer who lost nothing and no longer exists to read it.
        DB::table('memberships')
            ->where('id', $from->id)
            ->update(['points' => 0, 'lifetime_points' => 0, 'deleted_at' => now()]);

        app(PointsService::class)->recomputeTier($to->fresh());
    }

    /** Details the survivor is missing and the duplicate has. */
    private function fillBlanks(Customer $keep, Customer $merge): void
    {
        foreach (['phone', 'email', 'line_user_id', 'picture_url', 'display_name'] as $field) {
            if (blank($keep->{$field}) && filled($merge->{$field})) {
                $keep->{$field} = $merge->{$field};
            }
        }

        // Totals are sums of things that moved, so they move too.
        $keep->total_spending = (float) $keep->total_spending + (float) $merge->total_spending;
        $keep->visits = (int) $keep->visits + (int) $merge->visits;

        // Consent belongs to the person, and the stricter answer wins: a
        // merge must never turn "do not contact me" into permission to.
        if ($merge->unsubscribed_at !== null) {
            $keep->marketing_consent = false;
            $keep->unsubscribed_at = $keep->unsubscribed_at ?? $merge->unsubscribed_at;
        }
    }
}
