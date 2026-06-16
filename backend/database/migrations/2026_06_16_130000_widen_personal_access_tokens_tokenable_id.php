<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Sanctum's create migration uses morphs('tokenable'), which makes
 * tokenable_id a BIGINT UNSIGNED. That works for User (numeric id) but NOT for
 * Customer, which uses HasUuids — inserting a UUID into a BIGINT column on
 * MySQL/MariaDB fails with "Data truncated for column 'tokenable_id'", so
 * customer (LINE) login 500s. SQLite ignores column types, which is why local
 * dev/tests never caught it.
 *
 * Widen tokenable_id to CHAR(36) so the polymorphic column holds both UUIDs and
 * numeric ids. MySQL rebuilds the (tokenable_type, tokenable_id) index in place.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            return; // SQLite stores UUIDs in any column — nothing to fix.
        }

        DB::statement('ALTER TABLE `personal_access_tokens` MODIFY `tokenable_id` CHAR(36) NOT NULL');
    }

    public function down(): void
    {
        if (! in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        DB::statement('ALTER TABLE `personal_access_tokens` MODIFY `tokenable_id` BIGINT UNSIGNED NOT NULL');
    }
};
