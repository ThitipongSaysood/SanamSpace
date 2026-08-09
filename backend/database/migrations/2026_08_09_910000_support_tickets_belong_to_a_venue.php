<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Give a support ticket the venue it came from.
 *
 * The table only held `organization_name`, which was enough while the desk was
 * read-only — every row was seeded and a human matched them up by eye. It stops
 * being enough the moment venues can open their own: a venue must see its own
 * thread and nobody else's, and matching by name would show one venue another's
 * conversation the day two venues are named the same.
 *
 * Nullable and without a foreign key, like the audit log: a ticket has to
 * outlive the venue it is about, and the older seeded rows have no id to point
 * at. The name stays denormalised so the desk still reads correctly afterwards.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('support_tickets', function (Blueprint $table) {
            $table->uuid('organization_id')->nullable()->after('ticket_no');
            $table->index('organization_id');
        });

        // Best-effort backfill for the rows that predate the column. An exact
        // name match only — a guess here would attach a stranger's ticket.
        foreach (DB::table('organizations')->select('id', 'name')->get() as $org) {
            DB::table('support_tickets')
                ->whereNull('organization_id')
                ->where('organization_name', $org->name)
                ->update(['organization_id' => $org->id]);
        }
    }

    public function down(): void
    {
        Schema::table('support_tickets', function (Blueprint $table) {
            $table->dropIndex(['organization_id']);
            $table->dropColumn('organization_id');
        });
    }
};
