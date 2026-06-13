<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Prepaid hour packages sold per organization (frontend VenuePackage).
        Schema::create('venue_packages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->string('name');
            $table->unsignedInteger('hours');
            $table->decimal('price', 12, 2);
            $table->unsignedInteger('valid_days');
            $table->unsignedTinyInteger('save_percent')->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('venue_packages');
    }
};
