<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The venue's own login screen.
 *
 * /v/{slug} was already themed — logo, the three colours, the venue's font —
 * but the two things that make it look like THAT venue's front door were still
 * the platform's: a flat background, and a line of copy every venue in the
 * system shared word for word.
 *
 * `login_cover_url` is the venue's own photo. Left empty, the app draws the
 * court of the sport the venue actually rents (read from its branches), which
 * is why this is nullable rather than seeded with something.
 *
 * `login_tagline` is the two lines under "เข้าสู่ระบบ". Also nullable: a venue
 * that has not written one gets a sentence built from its own name, not the
 * previous generic one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->string('login_cover_url')->nullable()->after('logo_url');
            $table->text('login_tagline')->nullable()->after('login_cover_url');
        });
    }

    public function down(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->dropColumn(['login_cover_url', 'login_tagline']);
        });
    }
};
