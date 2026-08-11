<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            // manual = staff review every slip (default).
            // auto   = a slip that passes the verifier is approved automatically;
            //          anything uncertain still falls to the manual queue.
            $table->string('slip_verify_mode', 10)->default('manual')->after('checkin_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->dropColumn('slip_verify_mode');
        });
    }
};
