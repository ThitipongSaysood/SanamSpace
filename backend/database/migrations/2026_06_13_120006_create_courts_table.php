<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('courts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('branch_id');
            $table->string('name');
            $table->string('sport', 50);
            $table->decimal('price_per_hour', 12, 2)->default(0);
            // Court spec fields (inline) -> frontend CourtSpec shape.
            $table->string('floor')->nullable();
            $table->string('aircon')->nullable();
            $table->string('height')->nullable();
            $table->string('lighting')->nullable();
            $table->string('standard')->nullable();
            $table->string('players')->nullable();
            $table->string('status', 50)->default('active');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('branch_id')->references('id')->on('branches')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('courts');
    }
};
