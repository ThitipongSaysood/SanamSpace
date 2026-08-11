<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Link a marketing promotion to a real coupon, so a customer who taps
        // the promo lands on the booking screen with the code already applied.
        // Nullable: a promotion can still be a plain announcement.
        Schema::table('promotions', function (Blueprint $table) {
            $table->uuid('coupon_id')->nullable()->after('tag');
            $table->foreign('coupon_id')->references('id')->on('coupons')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->dropForeign(['coupon_id']);
            $table->dropColumn('coupon_id');
        });
    }
};
