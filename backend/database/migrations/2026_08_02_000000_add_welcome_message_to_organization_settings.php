<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A greeting the venue writes for its own customers.
 *
 * The customer home had no way for a venue to say anything — the only message
 * on it was a hard-coded "โปรโมชั่นลด 10%" that every venue showed regardless of
 * whether it ran that promotion. This gives them somewhere real to speak from;
 * the promo strip beside it now comes from their actual `promotions` rows.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->string('welcome_title')->nullable();
            $table->text('welcome_message')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->dropColumn(['welcome_title', 'welcome_message']);
        });
    }
};
