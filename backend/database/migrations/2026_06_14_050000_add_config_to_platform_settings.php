<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('platform_settings', function (Blueprint $table) {
            // --- Mail / SMTP (read at runtime, overrides .env) ---
            $table->string('mail_mailer', 30)->default('log')->after('language'); // log|smtp|sendmail
            $table->string('mail_host')->nullable()->after('mail_mailer');
            $table->string('mail_port', 10)->nullable()->after('mail_host');
            $table->string('mail_username')->nullable()->after('mail_port');
            $table->text('mail_password')->nullable()->after('mail_username'); // encrypted at rest
            $table->string('mail_encryption', 10)->nullable()->after('mail_password'); // tls|ssl|null
            $table->string('mail_from_address')->nullable()->after('mail_encryption');
            $table->string('mail_from_name')->nullable()->after('mail_from_address');

            // --- Platform billing payment details (for invoices/receipts) ---
            $table->string('promptpay_id')->nullable()->after('mail_from_name');
            $table->string('bank_name')->nullable()->after('promptpay_id');
            $table->string('bank_account_name')->nullable()->after('bank_name');
            $table->string('bank_account_number')->nullable()->after('bank_account_name');
        });
    }

    public function down(): void
    {
        Schema::table('platform_settings', function (Blueprint $table) {
            $table->dropColumn([
                'mail_mailer', 'mail_host', 'mail_port', 'mail_username', 'mail_password',
                'mail_encryption', 'mail_from_address', 'mail_from_name',
                'promptpay_id', 'bank_name', 'bank_account_name', 'bank_account_number',
            ]);
        });
    }
};
