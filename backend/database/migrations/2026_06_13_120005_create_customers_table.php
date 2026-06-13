<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->string('line_user_id')->nullable();
            $table->string('display_name');
            $table->string('phone', 50)->nullable();
            $table->string('email')->nullable();
            $table->string('picture_url')->nullable();
            $table->decimal('total_spending', 12, 2)->default(0);
            $table->unsignedInteger('visits')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->index(['organization_id', 'line_user_id']);
        });

        Schema::create('line_profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('customer_id');
            $table->string('line_user_id');
            $table->string('display_name')->nullable();
            $table->string('picture_url')->nullable();
            $table->timestamps();

            $table->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('line_profiles');
        Schema::dropIfExists('customers');
    }
};
