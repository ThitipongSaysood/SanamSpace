<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Letting the customer redeem from the app.
 *
 * Redemption was staff-only on purpose: a bottle of water still has to be
 * handed over, and a redemption nobody collects is a promise nobody is
 * watching. The venue wants in-app redemption anyway, so the promise gets a
 * name — every redemption now has a state, a short code, and a queue staff can
 * actually see.
 *
 * Two shapes, because they are genuinely different:
 *
 * - `credit` and `hours` arrive instantly. Nothing to hand over, so they are
 *   `collected` the moment they are made.
 * - `product` is `pending` until someone at the counter hands it over. The
 *   stock is taken at redemption, not at collection: the customer has already
 *   paid points for that bottle, and letting someone else buy it would be
 *   selling the same thing twice.
 *
 * Uncollected ones expire and give the points back — see PointsService. Without
 * that the queue only grows, which is the objection to in-app redemption in the
 * first place.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reward_redemptions', function (Blueprint $table) {
            $table->string('status', 20)->default('collected')->after('type');
            // Short and human-readable: staff type it off a phone screen, so it
            // is not a uuid and not the customer id.
            $table->string('code', 12)->nullable()->after('status');
            $table->timestamp('collected_at')->nullable()->after('code');
            $table->uuid('collected_by')->nullable()->after('collected_at');
            $table->timestamp('expires_at')->nullable()->after('collected_by');

            $table->index(['organization_id', 'status']);
            $table->unique(['organization_id', 'code']);
        });

        // Everything that already exists was handed over at the counter.
        DB::table('reward_redemptions')->update([
            'status' => 'collected',
            'collected_at' => DB::raw('created_at'),
        ]);

        Schema::table('organization_settings', function (Blueprint $table) {
            // Off until the venue says so: a code nobody at the counter is
            // expecting is worse than no button at all.
            $table->boolean('self_redeem_enabled')->default(false)->after('points_expiry_warn_days');
            // How long a customer has to collect before it is returned.
            $table->unsignedInteger('redeem_collect_hours')->default(48)->after('self_redeem_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->dropColumn(['self_redeem_enabled', 'redeem_collect_hours']);
        });

        Schema::table('reward_redemptions', function (Blueprint $table) {
            $table->dropUnique(['organization_id', 'code']);
            $table->dropIndex(['organization_id', 'status']);
            $table->dropColumn(['status', 'code', 'collected_at', 'collected_by', 'expires_at']);
        });
    }
};
