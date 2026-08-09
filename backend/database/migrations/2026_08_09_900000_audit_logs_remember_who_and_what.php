<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Let an audit entry say WHO did it and WHICH venue it was done to.
 *
 * The table only ever held a display name, so two admins with the same name
 * were indistinguishable and there was no way to ask "what has been done to
 * this venue" — the one question the organisation drawer needs to answer.
 *
 * Both columns are nullable and carry no foreign key on purpose: an audit
 * entry has to outlive the row it points at. Deleting a venue must not delete
 * the record of it being suspended, and `user_name` stays denormalised so the
 * log still reads correctly after someone is renamed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->uuid('user_id')->nullable()->after('id');
            $table->uuid('organization_id')->nullable()->after('user_id');
            $table->index('organization_id');
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex(['organization_id']);
            $table->dropColumn(['user_id', 'organization_id']);
        });
    }
};
