<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who moved a customer's credit, and why.
 *
 * The ledger recorded what changed and when, but not who did it — so "staff
 * added ฿5,000 to a customer's balance" was indistinguishable from a top-up the
 * customer paid for, and neither could be traced to a person. Credit is money;
 * money that can be created by hand needs a name against every hand.
 *
 * `created_by` is nullable because the customer's own top-ups have no staff
 * behind them, and `source` says which kind of movement it was so the two are
 * never confused when reading the history back.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wallet_transactions', function (Blueprint $table) {
            $table->uuid('created_by')->nullable()->after('status');
            // topup | booking | refund | adjustment — what caused this line.
            $table->string('source', 20)->nullable()->after('created_by');
            $table->index(['wallet_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('wallet_transactions', function (Blueprint $table) {
            $table->dropIndex(['wallet_id', 'created_at']);
            $table->dropColumn(['created_by', 'source']);
        });
    }
};
