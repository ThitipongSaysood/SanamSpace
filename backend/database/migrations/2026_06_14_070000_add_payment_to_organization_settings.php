<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            // Each venue receives booking payments into ITS OWN account.
            $table->string('promptpay_id')->nullable()->after('email');       // phone / national id / e-wallet
            $table->string('promptpay_name')->nullable()->after('promptpay_id'); // display name on the QR screen
            $table->string('bank_name')->nullable()->after('promptpay_name');
            $table->string('bank_account_name')->nullable()->after('bank_name');
            $table->string('bank_account_number')->nullable()->after('bank_account_name');
        });
    }

    public function down(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->dropColumn([
                'promptpay_id', 'promptpay_name', 'bank_name', 'bank_account_name', 'bank_account_number',
            ]);
        });
    }
};
