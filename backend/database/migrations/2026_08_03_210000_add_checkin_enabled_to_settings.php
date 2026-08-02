<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Whether this venue uses QR check-in at all.
 *
 * A small venue with one person at the desk who recognises every regular does
 * not need a scanner, and showing customers a QR nobody ever scans is worse
 * than not showing one. On by default, because the screen already exists in the
 * customer app and turning it off should be a deliberate choice.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->boolean('checkin_enabled')->default(true);
        });
    }

    public function down(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->dropColumn('checkin_enabled');
        });
    }
};
