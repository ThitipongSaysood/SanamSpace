<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organizations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug', 100)->unique();
            $table->string('business_type', 100)->nullable();
            $table->string('status', 50)->default('active');
            $table->string('timezone', 100)->default('Asia/Bangkok');
            $table->timestamp('trial_start_at')->nullable();
            $table->timestamp('trial_end_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organizations');
    }
};
