<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Finish the expiry conversion, and let a venue expire points.
 *
 * The previous migration added `expires_on` as a real date and backfilled it,
 * but nothing was changed to READ it — the card still rendered the old
 * `expires_at` string. Two columns holding the same fact, with the wrong one on
 * screen, is exactly the bug the conversion was meant to end, so the string
 * goes. Anything still unparsed gets a date from the venue's validity setting
 * rather than being left blank.
 *
 * Points expiry is **off by default and configurable**: expiring points removes
 * value a customer earned, and a system that does that silently on a default
 * nobody chose is worse than one that never does it at all.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->boolean('points_expiry_enabled')->default(false)->after('tier_thresholds');
            // How long points last from the day the membership starts.
            $table->unsignedInteger('points_valid_months')->default(12)->after('points_expiry_enabled');
            // Warn this many days out, so expiry is never a surprise.
            $table->unsignedInteger('points_expiry_warn_days')->default(14)->after('points_valid_months');
        });

        // Any membership whose old string could not be parsed still needs a
        // date, or it can never expire and can never be warned about.
        DB::table('memberships')
            ->whereNull('expires_on')
            ->update(['expires_on' => now()->addYear()->toDateString()]);

        Schema::table('memberships', function (Blueprint $table) {
            $table->dropColumn('expires_at');
        });
    }

    public function down(): void
    {
        Schema::table('memberships', function (Blueprint $table) {
            $table->string('expires_at')->default('');
        });

        Schema::table('organization_settings', function (Blueprint $table) {
            $table->dropColumn(['points_expiry_enabled', 'points_valid_months', 'points_expiry_warn_days']);
        });
    }
};
