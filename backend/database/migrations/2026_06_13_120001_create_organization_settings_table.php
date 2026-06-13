<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organization_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->string('logo')->nullable();
            $table->string('primary_color', 20)->nullable();
            $table->string('secondary_color', 20)->nullable();
            $table->string('accent_color', 20)->nullable();
            $table->string('font_family', 100)->nullable();
            $table->text('line_oa_url')->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('email')->nullable();
            $table->text('address')->nullable();
            $table->text('google_map_url')->nullable();
            $table->string('timezone', 100)->default('Asia/Bangkok');
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organization_settings');
    }
};
