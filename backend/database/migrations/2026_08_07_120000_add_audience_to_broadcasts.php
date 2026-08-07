<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A broadcast previously targeted either a saved segment or the whole
        // org. `audience` adds smart presets computed from booking history —
        // lost (churned), regulars, one-timers, newcomers — so a venue can blast
        // a promo straight at "the customers who stopped coming" without first
        // curating a segment. `inactive_days` is the day window for the presets
        // that need one (lost / new).
        Schema::table('broadcasts', function (Blueprint $table) {
            $table->string('audience', 20)->default('all')->after('segment_id');
            $table->unsignedInteger('inactive_days')->nullable()->after('audience');
        });
    }

    public function down(): void
    {
        Schema::table('broadcasts', function (Blueprint $table) {
            $table->dropColumn(['audience', 'inactive_days']);
        });
    }
};
