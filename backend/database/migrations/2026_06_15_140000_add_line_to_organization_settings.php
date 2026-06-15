<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-venue LINE integration. Each org configures its OWN LINE Login channel
 * (customer auth) + LIFF + Messaging OA. Secrets are stored encrypted at rest
 * (see OrganizationSetting casts). Falls back to the global services.line.*
 * (.env) config when an org leaves these blank.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->string('line_channel_id')->nullable()->after('line_oa_url');       // LINE Login channel id
            $table->text('line_channel_secret')->nullable()->after('line_channel_id'); // encrypted at rest
            $table->string('line_liff_id')->nullable()->after('line_channel_secret');  // LIFF app id (frontend)
            $table->text('line_messaging_token')->nullable()->after('line_liff_id');   // OA Messaging API token, encrypted
        });
    }

    public function down(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->dropColumn(['line_channel_id', 'line_channel_secret', 'line_liff_id', 'line_messaging_token']);
        });
    }
};
