<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Whether a platform user may still sign in.
 *
 * The admin list already displayed a "สถานะ" column, but it was a hard-coded
 * "active" for everyone — there was nowhere to record that someone had left.
 * Deleting the account was the only option, which also takes their audit trail
 * and their name off past records.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('status', 20)->default('active')->after('is_super_admin');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }
};
