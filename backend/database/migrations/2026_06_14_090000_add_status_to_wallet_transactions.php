<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wallet_transactions', function (Blueprint $table) {
            // completed = posted to balance; pending/pending_review = customer top-up awaiting approval; rejected
            $table->string('status', 20)->default('completed')->after('amount');
            $table->string('slip_url')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('wallet_transactions', function (Blueprint $table) {
            $table->dropColumn(['status', 'slip_url']);
        });
    }
};
