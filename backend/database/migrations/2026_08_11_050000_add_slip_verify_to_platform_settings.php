<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The slip-verification provider is a platform-level integration: one Slip2Go
 * account, paid by the operator, that every venue rents the use of. So its
 * connection and a global on/off master switch live on the platform settings
 * (admin-controlled), not on each org. A venue only gets a per-venue toggle,
 * gated by its plan — it never brings its own key.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('platform_settings', function (Blueprint $table) {
            // Master switch: off = no venue auto-verifies, whatever its plan/toggle.
            $table->boolean('slip_verify_enabled')->default(false)->after('language');
            // Provider connection. Null driver falls back to the env config so a
            // local/CI setup keeps working without touching the admin screen.
            $table->string('slip_verify_driver', 20)->nullable()->after('slip_verify_enabled');
            $table->string('slip_verify_endpoint', 500)->nullable()->after('slip_verify_driver');
            // API Secret — encrypted at rest, write-only in the API (same as SMTP).
            $table->text('slip_verify_key')->nullable()->after('slip_verify_endpoint');
        });
    }

    public function down(): void
    {
        Schema::table('platform_settings', function (Blueprint $table) {
            $table->dropColumn(['slip_verify_enabled', 'slip_verify_driver', 'slip_verify_endpoint', 'slip_verify_key']);
        });
    }
};
