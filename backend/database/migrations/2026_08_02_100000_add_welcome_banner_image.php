<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A banner image for the venue's welcome card.
 *
 * Text alone cannot carry a seasonal promotion or an event poster — the things
 * venues actually want to put in front of customers. The image is optional and
 * stands on its own: a venue may post only a picture, only words, or both.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->string('welcome_image_url', 2000)->nullable()->after('welcome_message');
            // Where the banner leads when tapped. Blank = not tappable.
            $table->string('welcome_link', 2000)->nullable()->after('welcome_image_url');
        });
    }

    public function down(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->dropColumn(['welcome_image_url', 'welcome_link']);
        });
    }
};
