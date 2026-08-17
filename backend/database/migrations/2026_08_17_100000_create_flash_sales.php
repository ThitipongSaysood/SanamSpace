<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Flash sales: a time-windowed court discount that applies ITSELF.
 *
 * A coupon is a code the customer types; a flash sale is the venue quietly
 * dropping its court price on chosen hours ("จ.–ศ. 13:00–16:00 ลด 20%") so the
 * booking screen shows the cut and charges it without anyone typing anything.
 * It reuses the booking's discount snapshot (`discount_amount`/`discount_label`)
 * — the same reason coupons do — so a sale edited or ended next month never
 * rewrites what someone was charged today. `flash_sale_id` records which one
 * won, for the receipt and for "why was this cheaper".
 *
 * Times are the VENUE's wall clock (HH:MM strings), matching `bookings.start`
 * /`.end` and coupons' own window columns; a TIME column comes back out
 * differently on SQLite vs MySQL and every compare here is a string compare.
 *
 * Scope rows say WHERE it applies: a row per branch OR per court. No rows at
 * all means the whole venue — so a sale that should cover everything is the
 * empty, not the exhaustive, case.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('flash_sales', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->string('name');                              // "ลดช่วงบ่าย"
            $table->string('discount_type', 10)->default('percent'); // percent | fixed
            $table->decimal('discount_value', 10, 2);            // 20 = 20% (percent) or ฿ off (fixed)
            $table->decimal('max_discount', 10, 2)->nullable();  // cap for a percent sale, per booking
            // The daily window this sale runs. Required in practice — a flash
            // sale with no hours is just a plain discount.
            $table->string('valid_from_time', 5)->nullable();    // "13:00"
            $table->string('valid_to_time', 5)->nullable();      // "16:00"
            $table->json('valid_days')->nullable();              // ISO 1=Mon…7=Sun; null = every day
            // Optional campaign range (the sale itself starts/ends on a date).
            $table->date('starts_at')->nullable();
            $table->date('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->index(['organization_id', 'is_active']);
        });

        Schema::create('flash_sale_scopes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('flash_sale_id');
            // Exactly one of these is set per row: a whole branch, or one court.
            // Both null never happens (the "whole venue" case is zero rows).
            $table->uuid('branch_id')->nullable();
            $table->uuid('court_id')->nullable();

            $table->foreign('flash_sale_id')->references('id')->on('flash_sales')->cascadeOnDelete();
            $table->foreign('branch_id')->references('id')->on('branches')->cascadeOnDelete();
            $table->foreign('court_id')->references('id')->on('courts')->cascadeOnDelete();
            $table->index('flash_sale_id');
        });

        Schema::table('bookings', function (Blueprint $table) {
            // Which sale the snapshot discount came from, when a flash sale won.
            $table->uuid('flash_sale_id')->nullable()->after('coupon_id');
            $table->foreign('flash_sale_id')->references('id')->on('flash_sales')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropForeign(['flash_sale_id']);
            $table->dropColumn('flash_sale_id');
        });
        Schema::dropIfExists('flash_sale_scopes');
        Schema::dropIfExists('flash_sales');
    }
};
