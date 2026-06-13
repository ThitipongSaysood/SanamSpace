<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Branch is the customer-facing "Venue".
        Schema::create('branches', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->string('name');
            $table->text('address')->nullable();
            $table->string('phone', 50)->nullable();
            $table->time('open_time')->nullable();
            $table->time('close_time')->nullable();
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->decimal('distance_km', 6, 2)->nullable();
            // Display fields surfaced to the customer frontend Venue shape.
            $table->decimal('rating', 3, 2)->default(0);
            $table->unsignedInteger('review_count')->default(0);
            $table->string('image_url')->nullable();
            $table->json('sports')->nullable();
            $table->json('facilities')->nullable();
            $table->string('travel_hint')->nullable();
            $table->string('peak_note')->nullable();
            $table->text('description')->nullable();
            $table->json('week_hours')->nullable();
            $table->string('status', 50)->default('active');
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branches');
    }
};
