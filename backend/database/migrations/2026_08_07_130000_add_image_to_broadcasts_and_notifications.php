<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A broadcast can carry a banner image (a promo poster). It travels to
        // LINE as an image message and to the in-app notification as a banner.
        Schema::table('broadcasts', function (Blueprint $table) {
            $table->string('image_url')->nullable()->after('message');
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->string('image_url')->nullable()->after('body');
        });
    }

    public function down(): void
    {
        Schema::table('broadcasts', function (Blueprint $table) {
            $table->dropColumn('image_url');
        });
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropColumn('image_url');
        });
    }
};
