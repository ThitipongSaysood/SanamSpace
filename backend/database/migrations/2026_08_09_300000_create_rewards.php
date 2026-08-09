<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What points are worth: a catalogue of things they buy.
 *
 * Points that cannot be spent are a number on a card. The venue's example was
 * "50 คะแนน แลกน้ำ", so a reward points at a POS product — but the same row
 * shape covers credit and free hours, because those were the other two answers
 * and adding a table per reward type would be three tables saying the same
 * thing.
 *
 * `reward_redemptions` snapshots the name and the cost. Reprice a reward
 * tomorrow and last week's redemption still says what it actually cost — the
 * same rule as rental lines, discounts and package purchases.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rewards', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->string('name');
            $table->unsignedInteger('points_cost');
            // product | credit | hours
            $table->string('type', 20)->default('product');
            // Exactly one of these is set, decided by `type`.
            $table->uuid('product_id')->nullable();
            $table->decimal('credit_amount', 10, 2)->nullable();
            $table->decimal('hours', 5, 2)->nullable();
            $table->string('image_url', 2000)->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            // Retiring a product must not delete the reward's history.
            $table->foreign('product_id')->references('id')->on('products')->nullOnDelete();
            $table->index(['organization_id', 'is_active', 'sort_order']);
        });

        Schema::create('reward_redemptions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('customer_id');
            $table->uuid('reward_id')->nullable();
            // Snapshots: what it was called and what it cost, at the time.
            $table->string('name');
            $table->unsignedInteger('points_spent');
            $table->string('type', 20);
            $table->uuid('redeemed_by')->nullable(); // the staff member at the counter
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();
            $table->foreign('reward_id')->references('id')->on('rewards')->nullOnDelete();
            $table->index(['customer_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reward_redemptions');
        Schema::dropIfExists('rewards');
    }
};
