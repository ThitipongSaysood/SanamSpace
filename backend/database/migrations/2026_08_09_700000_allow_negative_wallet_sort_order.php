<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `wallet_transactions.sort_order` has to be signed — the same bug as reviews,
 * in the table that holds people's money.
 *
 * A credit statement reads newest first, so CreditService::nextSort inserts
 * `min(sort_order) - 1`, which is -1 for a customer's first transaction. The
 * column was declared unsigned.
 *
 * SQLite does not enforce that, so every dev run and all 523 tests passed. MySQL
 * does: "Numeric value out of range: 1264". On production this means **every**
 * top-up, every refund to credit and every booking paid with credit returns a
 * 500 — the money feature is entirely broken there and nothing here could say
 * so, because nothing here ran against MySQL.
 *
 * Found by running the suite against MySQL while adding that to CI. The
 * identical fix was applied to `reviews` a day earlier; this table was missed
 * because the search was for the symptom, not for the pattern.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wallet_transactions', function (Blueprint $table) {
            $table->integer('sort_order')->default(0)->change();
        });
    }

    public function down(): void
    {
        Schema::table('wallet_transactions', function (Blueprint $table) {
            $table->unsignedInteger('sort_order')->default(0)->change();
        });
    }
};
