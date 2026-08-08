<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Point of sale — the drinks fridge at the counter.
 *
 * Three tables rather than two, because a sale is a financial record and a
 * product is not:
 *
 * - `products` is the current catalogue. Names change, prices change, things
 *   get discontinued.
 * - `product_sales` is one receipt.
 * - `product_sale_items` **snapshots the name and unit price** at the moment of
 *   sale. Joining back to `products` for the price would rewrite last month's
 *   takings the first time someone edits a price, and a receipt that changes
 *   after the fact is not a receipt.
 *
 * Stock lives on `products.stock_qty` and is moved only inside a transaction —
 * see PosService. This project already shipped a double-booking race by doing
 * read-then-write without a lock; overselling the fridge is the same bug with a
 * different table.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->string('name');
            $table->string('category', 80)->nullable();
            $table->decimal('price', 10, 2);
            $table->integer('stock_qty')->default(0);
            // Below this, the till shows a warning but still sells. "Nearly out"
            // is information, not a reason to refuse a customer holding cash.
            $table->unsignedInteger('low_stock_threshold')->default(5);
            $table->string('image_url', 2000)->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            // The till asks one question: what can I sell right now, in order.
            $table->index(['organization_id', 'is_active', 'sort_order']);
        });

        Schema::create('product_sales', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->string('code', 32)->unique();
            $table->decimal('total', 10, 2);
            $table->string('payment_method', 20); // cash | transfer
            $table->string('status', 20)->default('completed'); // completed | voided
            // Who rang it up. Kept when the sale is voided, which is exactly when
            // someone wants to know.
            $table->unsignedBigInteger('sold_by')->nullable();
            $table->timestamp('sold_at');
            $table->timestamp('voided_at')->nullable();
            $table->string('void_reason', 255)->nullable();
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('sold_by')->references('id')->on('users')->nullOnDelete();
            // "What did we take today" — the report this table exists for.
            $table->index(['organization_id', 'sold_at']);
        });

        Schema::create('product_sale_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('product_sale_id');
            // Nullable: a product may later be deleted, and its past sales must
            // survive that. The snapshot below is what keeps the line readable.
            $table->uuid('product_id')->nullable();
            $table->string('name');
            $table->decimal('unit_price', 10, 2);
            $table->unsignedInteger('quantity');
            $table->decimal('line_total', 10, 2);
            $table->timestamps();

            $table->foreign('product_sale_id')->references('id')->on('product_sales')->cascadeOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_sale_items');
        Schema::dropIfExists('product_sales');
        Schema::dropIfExists('products');
    }
};
