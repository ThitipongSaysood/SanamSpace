<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\CustomerPackage;
use App\Models\Reward;
use App\Models\RewardRedemption;
use App\Models\Membership;
use App\Models\OrganizationSetting;
use App\Models\PointTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Points that a booking actually earns.
 *
 * The rule the venue chose: **a flat number of points per booking**, court
 * bookings only. Not per baht — "จอง 1 ครั้ง ได้ 10 แต้ม" is a rule a customer
 * can repeat back, and one an hour-long booking and a three-hour booking share
 * on purpose.
 *
 * Two things decide when, and both are deliberate:
 *
 * - **Earned when the booking is fully paid, not when it is made.** A booking
 *   that has not been paid for is a reservation, and awarding on creation would
 *   let anyone farm points by booking and cancelling.
 * - **Taken back when it is cancelled.** Otherwise the same farm works one step
 *   later: pay, collect, cancel, get the money back as credit, keep the points.
 *
 * `lifetime_points` is what tiers are judged on, so spending points can never
 * demote someone who already reached Gold.
 */
class PointsService
{
    /** Used when a venue has not configured its own ladder. */
    public const DEFAULT_TIERS = ['Silver' => 0, 'Gold' => 500, 'Platinum' => 2000];

    /**
     * Award a booking's points, once.
     *
     * Idempotent on (booking, source): payment approval, a counter settle and a
     * credit payment can all land on the same booking, and each of them asks.
     */
    public function awardForBooking(Booking $booking): void
    {
        $settings = $this->settings($booking->organization_id);

        if (! $settings?->points_enabled || ! $booking->customer_id) {
            return;
        }

        // Nothing owing, and still a real booking.
        if ($booking->status === 'cancelled' || $this->outstanding($booking) > 0) {
            return;
        }

        $points = (int) $settings->points_per_booking;

        if ($points <= 0) {
            return;
        }

        DB::transaction(function () use ($booking, $points) {
            $already = PointTransaction::query()
                ->where('booking_id', $booking->id)
                ->where('source', 'booking')
                ->lockForUpdate()
                ->exists();

            if ($already) {
                return;
            }

            PointTransaction::create([
                'organization_id' => $booking->organization_id,
                'customer_id' => $booking->customer_id,
                'points' => $points,
                'source' => 'booking',
                'label' => 'จอง '.$booking->code,
                'booking_id' => $booking->id,
            ]);

            $this->apply($booking->customer, $points, LifetimeEffect::Earned);
        });
    }

    /**
     * Take back what a booking earned, if it earned anything.
     *
     * Called on cancellation. Without it the farm is: pay, collect the points,
     * cancel, take the money back as credit, keep the points.
     */
    public function revokeForBooking(Booking $booking): void
    {
        DB::transaction(function () use ($booking) {
            $earned = PointTransaction::query()
                ->where('booking_id', $booking->id)
                ->where('source', 'booking')
                ->lockForUpdate()
                ->sum('points');

            if ($earned <= 0) {
                return;
            }

            // Already clawed back — cancelling twice must not charge twice.
            $returned = abs((int) PointTransaction::query()
                ->where('booking_id', $booking->id)
                ->where('source', 'cancellation')
                ->sum('points'));

            $owing = (int) $earned - $returned;

            if ($owing <= 0) {
                return;
            }

            PointTransaction::create([
                'organization_id' => $booking->organization_id,
                'customer_id' => $booking->customer_id,
                'points' => -$owing,
                'source' => 'cancellation',
                'label' => 'ยกเลิก '.$booking->code,
                'booking_id' => $booking->id,
            ]);

            // A clawback undoes points that turned out not to exist, so the
            // ladder must forget them — unlike spending, which does not.
            $this->apply($booking->customer, -$owing, LifetimeEffect::Reversed);
        });
    }

    /**
     * A staff adjustment, with the person who made it.
     *
     * The old endpoint took a `note` and threw it away — its own comment said
     * "accepted for audit intent but not persisted". Points are value staff can
     * create by hand; every one of them is answerable for now.
     */
    public function adjust(Customer $customer, int $delta, ?string $label, ?string $actorId): Membership
    {
        if ($delta === 0) {
            throw ValidationException::withMessages(['delta' => 'ต้องระบุจำนวนแต้มที่ต้องการปรับ']);
        }

        return DB::transaction(function () use ($customer, $delta, $label, $actorId) {
            $membership = $this->membershipFor($customer);

            // Refuse rather than silently flooring at 0: "took 500 from someone
            // who had 100" is a mistake worth telling the person about.
            if ($delta < 0 && (int) $membership->points + $delta < 0) {
                throw ValidationException::withMessages([
                    'delta' => "ลูกค้ามี {$membership->points} แต้ม หักมากกว่านี้ไม่ได้",
                ]);
            }

            PointTransaction::create([
                'organization_id' => $customer->organization_id,
                'customer_id' => $customer->id,
                'points' => $delta,
                'source' => 'adjustment',
                'label' => $label ?: ($delta > 0 ? 'เพิ่มแต้มโดยพนักงาน' : 'หักแต้มโดยพนักงาน'),
                'created_by' => $actorId,
            ]);

            // A staff deduction is SPENDING, not a reversal: taking 40 points
            // off someone who reached Gold must not demote them. Only a
            // cancellation unwinds the ladder.
            return $this->apply(
                $customer,
                $delta,
                $delta > 0 ? LifetimeEffect::Earned : LifetimeEffect::Spent,
            );
        });
    }

    /**
     * Spend points on a reward, and hand the reward over.
     *
     * Points, stock and the record move together inside one transaction: a
     * customer whose points were taken and whose water never left the fridge is
     * worse off than one who was refused.
     *
     * Spending never demotes — the tier was earned, and using what you earned is
     * the point of earning it.
     */
    public function redeem(Customer $customer, Reward $reward, ?string $actorId = null): RewardRedemption
    {
        if (! $reward->is_active) {
            throw ValidationException::withMessages(['reward' => 'ของรางวัลนี้ปิดการแลกอยู่']);
        }

        return DB::transaction(function () use ($customer, $reward, $actorId) {
            $membership = $this->membershipFor($customer);
            $cost = (int) $reward->points_cost;

            if ((int) $membership->points < $cost) {
                $short = $cost - (int) $membership->points;
                throw ValidationException::withMessages([
                    'reward' => "คะแนนไม่พอ ขาดอีก {$short} คะแนน",
                ]);
            }

            // Whatever the reward actually is, handed over before the points are
            // taken — so a failure here refuses instead of charging for nothing.
            $this->deliver($customer, $reward);

            $redemption = RewardRedemption::create([
                'organization_id' => $customer->organization_id,
                'customer_id' => $customer->id,
                'reward_id' => $reward->id,
                // Snapshots: repricing tomorrow must not rewrite this.
                'name' => $reward->name,
                'points_spent' => $cost,
                'type' => $reward->type,
                'redeemed_by' => $actorId,
            ]);

            PointTransaction::create([
                'organization_id' => $customer->organization_id,
                'customer_id' => $customer->id,
                'points' => -$cost,
                'source' => 'redemption',
                'label' => 'แลก '.$reward->name,
                'created_by' => $actorId,
            ]);

            $this->apply($customer, -$cost, LifetimeEffect::Spent);

            return $redemption;
        });
    }

    /** Give the customer whatever this reward is made of. */
    private function deliver(Customer $customer, Reward $reward): void
    {
        match ($reward->type) {
            'product' => $this->deliverProduct($reward),
            'credit' => app(CreditService::class)->add(
                $customer,
                (float) $reward->credit_amount,
                'แลกคะแนนเป็นเครดิต · '.$reward->name,
                'adjustment',
            ),
            'hours' => CustomerPackage::create([
                'organization_id' => $customer->organization_id,
                'customer_id' => $customer->id,
                'name' => $reward->name,
                'total_hours' => (float) $reward->hours,
                'remaining_hours' => (float) $reward->hours,
                'price' => 0, // redeemed, not sold — revenue must not count it
                'status' => 'active',
            ]),
            default => null,
        };
    }

    /**
     * Take the item off the shelf.
     *
     * A reward pointing at a product the venue has run out of is refused rather
     * than handed over on paper: the counter has nothing to give.
     */
    private function deliverProduct(Reward $reward): void
    {
        $product = $reward->product()->lockForUpdate()->first();

        if (! $product) {
            throw ValidationException::withMessages([
                'reward' => 'ของรางวัลนี้ไม่ได้ผูกกับสินค้า หรือสินค้าถูกลบไปแล้ว',
            ]);
        }

        if ((int) $product->stock_qty < 1) {
            throw ValidationException::withMessages([
                'reward' => "{$product->name} หมดสต็อก แลกไม่ได้",
            ]);
        }

        $product->decrement('stock_qty');
    }

    /**
     * Move the balance and re-decide the tier.
     *
     * The three cases are named because two of them look identical from the
     * balance's point of view and mean opposite things to the ladder:
     * spending 40 points is not the same as 40 points never having been earned.
     */
    private function apply(Customer $customer, int $delta, LifetimeEffect $effect): Membership
    {
        $membership = $this->membershipFor($customer);

        $points = max(0, (int) $membership->points + $delta);

        $lifetime = match ($effect) {
            LifetimeEffect::Earned => (int) $membership->lifetime_points + $delta,
            LifetimeEffect::Reversed => max(0, (int) $membership->lifetime_points + $delta),
            // Spending leaves the ladder alone — a tier already reached is not
            // taken back because the customer used what they earned.
            LifetimeEffect::Spent => (int) $membership->lifetime_points,
        };

        $membership->update([
            'points' => $points,
            'lifetime_points' => $lifetime,
            'tier' => $this->tierFor($customer->organization_id, $lifetime),
        ]);

        return $membership->fresh();
    }

    /**
     * The highest tier this many lifetime points reaches.
     *
     * Tier names come from the venue's own ladder because `member_discounts` is
     * keyed by the same names — a tier nobody can reach is a discount nobody
     * gets, which is exactly what "Silver forever" was.
     */
    public function tierFor(string $orgId, int $lifetimePoints): string
    {
        $ladder = $this->tiers($orgId);

        $tier = array_key_first($ladder);
        foreach ($ladder as $name => $needed) {
            if ($lifetimePoints >= (int) $needed) {
                $tier = $name;
            }
        }

        return $tier;
    }

    /** @return array<string,int> tier name => lifetime points needed, ascending */
    public function tiers(string $orgId): array
    {
        $configured = $this->settings($orgId)?->tier_thresholds;

        $ladder = is_array($configured) && $configured !== [] ? $configured : self::DEFAULT_TIERS;

        asort($ladder);

        return $ladder;
    }

    /** How far this customer is from the next tier, for the membership card. */
    public function progress(Membership $membership): array
    {
        $ladder = $this->tiers($membership->organization_id);
        $lifetime = (int) $membership->lifetime_points;

        $next = null;
        foreach ($ladder as $name => $needed) {
            if ($lifetime < (int) $needed) {
                $next = ['tier' => $name, 'needed' => (int) $needed];
                break;
            }
        }

        return [
            'tier' => $membership->tier,
            'lifetimePoints' => $lifetime,
            'nextTier' => $next['tier'] ?? null,
            'pointsToNextTier' => $next ? max(0, $next['needed'] - $lifetime) : null,
        ];
    }

    private function membershipFor(Customer $customer): Membership
    {
        return Membership::firstOrCreate(
            ['customer_id' => $customer->id],
            [
                'organization_id' => $customer->organization_id,
                'tier' => array_key_first($this->tiers($customer->organization_id)),
                'member_id' => 'SM-'.str_pad(
                    (string) (Membership::where('organization_id', $customer->organization_id)->count() + 1),
                    7, '0', STR_PAD_LEFT,
                ),
                'points' => 0,
                'lifetime_points' => 0,
                'expires_at' => '',
                'benefits' => [],
            ],
        );
    }

    private function outstanding(Booking $booking): float
    {
        return max(0, round((float) $booking->amount - (float) ($booking->paid_amount ?? 0), 2));
    }

    private function settings(string $orgId): ?OrganizationSetting
    {
        return OrganizationSetting::query()->where('organization_id', $orgId)->first();
    }
}
