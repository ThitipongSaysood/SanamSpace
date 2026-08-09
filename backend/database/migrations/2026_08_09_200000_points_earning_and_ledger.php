<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Points that are actually earned, and a record of every one of them.
 *
 * Before this the only thing that could change a customer's points was a staff
 * member typing a number. Booking, paying and turning up awarded nothing, tiers
 * never moved, and the `note` on an adjustment was accepted and thrown away —
 * the controller said so in a comment.
 *
 * Three things here:
 *
 * 1. `point_transactions` — one row per movement, signed, with what caused it
 *    and who. Same reason the credit ledger has it: points are value staff can
 *    create by hand, and a balance cannot answer "where did 500 points come
 *    from".
 * 2. Venue settings for the earn rate and the tier thresholds. The rate is a
 *    venue decision, not a constant.
 * 3. `memberships.expires_at` becomes a real date. It was a `string` holding
 *    pre-formatted Thai text ("31 ธ.ค. 2567") — impossible to compare, sort or
 *    query, so nothing could ever act on it. The seeded rows were two years
 *    expired and nothing noticed.
 */
return new class extends Migration
{
    /** Thai month abbreviations, as written by the old display-string code. */
    private const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

    public function up(): void
    {
        Schema::create('point_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('customer_id');
            // Signed: earning counts up, clawback and redemption count down. A
            // ledger that only ever adds cannot explain a balance going down.
            $table->integer('points');
            // booking | cancellation | adjustment | expiry | redemption
            $table->string('source', 20);
            $table->string('label')->nullable();
            $table->uuid('booking_id')->nullable();
            // Null = the system did it (earning from a booking). A name here
            // means a person chose to move someone's points by hand.
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();
            $table->foreign('booking_id')->references('id')->on('bookings')->nullOnDelete();
            $table->index(['customer_id', 'created_at']);
            // "Has this booking already earned?" — the idempotency question,
            // asked on every payment approval.
            $table->index(['booking_id', 'source']);
        });

        Schema::table('organization_settings', function (Blueprint $table) {
            $table->boolean('points_enabled')->default(false)->after('member_discounts');
            // Flat per booking: the venue chose "จอง 1 ครั้ง = 10 แต้ม" over
            // per-baht, because it is the rule a customer can repeat back.
            $table->unsignedInteger('points_per_booking')->default(10)->after('points_enabled');
            // { "Silver": 0, "Gold": 500, "Platinum": 2000 } — lifetime points
            // needed for each tier. Tier names must match `member_discounts`,
            // which is keyed the same way.
            $table->json('tier_thresholds')->nullable()->after('points_per_booking');
        });

        Schema::table('memberships', function (Blueprint $table) {
            // Points ever earned, which is what a tier is judged on. Spending
            // points must not demote someone who already reached Gold.
            $table->unsignedInteger('lifetime_points')->default(0)->after('points');
            $table->date('expires_on')->nullable()->after('expires_at');
        });

        // Carry the old display strings across to a real date where they can be
        // parsed. Anything unreadable becomes null — "we do not know" is a
        // better answer than a date invented to fill the column.
        foreach (DB::table('memberships')->get(['id', 'expires_at', 'points']) as $m) {
            DB::table('memberships')->where('id', $m->id)->update([
                'expires_on' => $this->parseThaiDate($m->expires_at),
                // Existing points were all granted by hand; treat them as
                // earned so nobody is demoted the moment tiers start working.
                'lifetime_points' => (int) $m->points,
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('memberships', function (Blueprint $table) {
            $table->dropColumn(['lifetime_points', 'expires_on']);
        });

        Schema::table('organization_settings', function (Blueprint $table) {
            $table->dropColumn(['points_enabled', 'points_per_booking', 'tier_thresholds']);
        });

        Schema::dropIfExists('point_transactions');
    }

    /** "31 ธ.ค. 2567" → 2024-12-31. Null when it cannot be read. */
    private function parseThaiDate(?string $value): ?string
    {
        if (blank($value)) {
            return null;
        }

        $parts = preg_split('/\s+/', trim($value));

        if (count($parts) !== 3) {
            return null;
        }

        [$day, $month, $year] = $parts;
        $monthIndex = array_search($month, self::TH_MONTHS, true);

        if ($monthIndex === false || ! ctype_digit($day) || ! ctype_digit($year)) {
            return null;
        }

        // Buddhist era → Gregorian.
        $gregorian = (int) $year - 543;

        if ($gregorian < 1970 || $gregorian > 2200) {
            return null;
        }

        return sprintf('%04d-%02d-%02d', $gregorian, $monthIndex + 1, (int) $day);
    }
};
