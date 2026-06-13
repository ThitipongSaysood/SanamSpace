<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Platform-level plans (no organization_id). Limits stored as nullable
        // integers where NULL means "unlimited" (∞ in the Feature Matrix).
        Schema::create('plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 100)->unique();
            $table->string('name');
            $table->decimal('price', 12, 2)->default(0);
            $table->string('interval', 50)->default('month');
            $table->unsignedInteger('branch_limit')->nullable();
            $table->unsignedInteger('court_limit')->nullable();
            $table->unsignedInteger('staff_limit')->nullable();
            $table->unsignedInteger('monthly_booking_limit')->nullable();
            $table->unsignedInteger('storage_gb')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        // Platform-level feature catalogue (no organization_id).
        Schema::create('features', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 150)->unique();
            $table->string('name');
            $table->timestamps();
            $table->softDeletes();
        });

        // Which plan enables which feature (pivot).
        Schema::create('plan_features', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('plan_id');
            $table->uuid('feature_id');
            $table->tinyInteger('enabled')->default(1);
            $table->timestamps();

            $table->foreign('plan_id')->references('id')->on('plans')->cascadeOnDelete();
            $table->foreign('feature_id')->references('id')->on('features')->cascadeOnDelete();
            $table->unique(['plan_id', 'feature_id']);
        });

        // Per-organization subscription to a plan.
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('plan_id');
            $table->string('status', 50)->default('active'); // active|trialing|past_due|cancelled
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('plan_id')->references('id')->on('plans');
            $table->index(['organization_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('plan_features');
        Schema::dropIfExists('features');
        Schema::dropIfExists('plans');
    }
};
