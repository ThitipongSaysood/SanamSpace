<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('platform_settings', function (Blueprint $table) {
            // --- Security ---
            $table->unsignedInteger('session_timeout_minutes')->default(0)->after('bank_account_number'); // 0 = ไม่หมดอายุ
            $table->unsignedInteger('password_min_length')->default(8)->after('session_timeout_minutes');
            $table->boolean('two_factor_required')->default(false)->after('password_min_length');

            // --- Notifications (which platform events email the admin) ---
            $table->boolean('notify_new_org')->default(true)->after('two_factor_required');
            $table->boolean('notify_payment')->default(true)->after('notify_new_org');
            $table->boolean('notify_subscription_expiring')->default(true)->after('notify_payment');
            $table->boolean('notify_support_ticket')->default(true)->after('notify_subscription_expiring');

            // --- Backup ---
            $table->string('backup_frequency', 20)->default('off')->after('notify_support_ticket'); // off|daily|weekly
            $table->unsignedInteger('backup_retention_days')->default(30)->after('backup_frequency');
        });
    }

    public function down(): void
    {
        Schema::table('platform_settings', function (Blueprint $table) {
            $table->dropColumn([
                'session_timeout_minutes', 'password_min_length', 'two_factor_required',
                'notify_new_org', 'notify_payment', 'notify_subscription_expiring', 'notify_support_ticket',
                'backup_frequency', 'backup_retention_days',
            ]);
        });
    }
};
