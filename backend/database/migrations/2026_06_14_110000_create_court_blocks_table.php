<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('court_blocks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('court_id');
            $table->date('date');
            $table->string('start', 5)->nullable(); // "10:00"; null start+end = whole day
            $table->string('end', 5)->nullable();
            $table->string('reason')->nullable();
            $table->timestamps();

            $table->index(['court_id', 'date']);
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('court_id')->references('id')->on('courts')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('court_blocks');
    }
};
