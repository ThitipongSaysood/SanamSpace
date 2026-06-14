<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Owner venue content (Phase 2 + 3): a photo gallery (multiple images) and a
 * floor-plan image for the venue map page.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->json('photos')->nullable()->after('image_url');
            $table->string('plan_image_url')->nullable()->after('photos');
        });
    }

    public function down(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->dropColumn(['photos', 'plan_image_url']);
        });
    }
};
