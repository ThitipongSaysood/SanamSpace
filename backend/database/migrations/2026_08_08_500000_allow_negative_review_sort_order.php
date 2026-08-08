<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `reviews.sort_order` has to be signed, because that is what the code writes.
 *
 * New reviews go to the top of the list, and the list is ordered by
 * `sort_order` ascending, so ReviewController inserts `min(sort_order) - 1` —
 * which is -1 for a branch's first review. The column was declared unsigned.
 *
 * SQLite does not enforce that, so every dev run and the whole test suite
 * accepted it. MySQL does: "Numeric value out of range: 1264 ... for column
 * 'sort_order'". On production this means a customer submitting a review gets
 * a 500 — a bug the SQLite-only test suite could never have found.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->integer('sort_order')->default(0)->change();
        });
    }

    public function down(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->unsignedInteger('sort_order')->default(0)->change();
        });
    }
};
