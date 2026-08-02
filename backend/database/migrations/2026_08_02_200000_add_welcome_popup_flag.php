<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Whether the welcome banner also greets customers as a popup on entry.
 *
 * Off by default: a dialog in someone's face the moment they open the app is
 * the venue's choice to make, not the platform's. The customer app remembers a
 * dismissal per banner version, so changing the banner shows it again while
 * leaving it alone does not nag.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->boolean('welcome_popup')->default(false)->after('welcome_link');
        });
    }

    public function down(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->dropColumn('welcome_popup');
        });
    }
};
