<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Equipment rental — rackets, shoes, a ball machine.
 *
 * Different from POS: a sold bottle is gone, a rented racket comes back. So
 * stock here is **how many the venue owns**, and availability is a question
 * about a time window: how many are already out during the hours you want.
 *
 * `booking_rentals` snapshots `name`, `unit_price` and `price_unit`, for the
 * same reason `product_sale_items` does — a later reprice must not change what
 * a customer was quoted and paid.
 *
 * `bookings.amount` becomes the **grand total** (court + rentals) so that every
 * existing payment, refund and revenue path keeps working untouched. The court
 * portion moves to its own column, backfilled from the current amount, because
 * without it the breakdown shown to the customer could not be reconstructed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rental_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->string('name');
            $table->string('category', 80)->nullable();
            $table->decimal('price', 10, 2);
            // per_session: one flat charge however long they play.
            // per_hour:    multiplied by the booking's hours.
            $table->string('price_unit', 20)->default('per_session');
            // How many the venue owns, NOT how many are left — what is left
            // depends on which hours you ask about.
            $table->unsignedInteger('stock_qty')->default(0);
            $table->string('image_url', 2000)->nullable();
            $table->text('note')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->index(['organization_id', 'is_active', 'sort_order']);
        });

        Schema::create('booking_rentals', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('booking_id');
            // Nullable so retiring an item cannot erase what past bookings were
            // charged; the snapshot below keeps the line readable.
            $table->uuid('rental_item_id')->nullable();
            $table->string('name');
            $table->decimal('unit_price', 10, 2);
            $table->string('price_unit', 20);
            $table->unsignedInteger('quantity');
            $table->decimal('hours', 5, 2);
            $table->decimal('line_total', 10, 2);
            $table->timestamps();

            $table->foreign('booking_id')->references('id')->on('bookings')->cascadeOnDelete();
            $table->foreign('rental_item_id')->references('id')->on('rental_items')->nullOnDelete();
            // "How many of this item are out between X and Y" — the availability
            // question, asked on every booking screen.
            $table->index(['rental_item_id', 'booking_id']);
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->decimal('court_amount', 10, 2)->default(0)->after('amount');
            $table->decimal('rental_total', 10, 2)->default(0)->after('court_amount');
        });

        // Every existing booking is court-only, so its amount IS the court
        // portion. Without this the breakdown would read ฿0 for the court.
        DB::table('bookings')->update(['court_amount' => DB::raw('amount')]);
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['court_amount', 'rental_total']);
        });

        Schema::dropIfExists('booking_rentals');
        Schema::dropIfExists('rental_items');
    }
};
