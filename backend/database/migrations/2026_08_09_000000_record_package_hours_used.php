<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * How many credit hours a booking actually spent.
 *
 * The booking already records WHICH package paid for it; how much it took was
 * only derivable from the slot length. That derivation drifts the moment the
 * booking is rescheduled to a different duration, and a receipt that says
 * "หัก 2 ชม." has to mean the two hours that were really deducted — not two
 * hours recomputed from whatever the booking looks like today.
 *
 * Snapshotted for the same reason rental lines and discounts are.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->decimal('package_hours_used', 5, 2)->default(0)->after('package_redeemed_at');
        });

        // Bookings already paid with credit have no recorded figure, and 0 is
        // not "we do not know" to a customer reading a receipt — it renders as
        // "−0 ชม.", which is worse than saying nothing. Their slot length is
        // the best available truth, and it is what was deducted at the time.
        foreach (DB::table('bookings')->whereNotNull('customer_package_id')->get(['id', 'start', 'end']) as $b) {
            $hours = (strtotime($b->end) - strtotime($b->start)) / 3600;

            DB::table('bookings')->where('id', $b->id)->update([
                'package_hours_used' => round(max(0, $hours), 2),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn('package_hours_used');
        });
    }
};
