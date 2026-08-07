<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Indexes for the way the Owner Portal actually reads.
 *
 * Every owner list is "this organization's rows, newest first", but the only
 * indexes on bookings were by court and by customer — so the org filter fell
 * back to a scan that grows with the whole platform's history, not just the
 * venue's. Same for payments, customers and the CRM timeline.
 */
return new class extends Migration
{
    /** table => [index name => columns] */
    private function plan(): array
    {
        return [
            'bookings' => [
                'bookings_org_date_index' => ['organization_id', 'date'],
                'bookings_org_status_index' => ['organization_id', 'status'],
            ],
            'payments' => [
                'payments_org_created_index' => ['organization_id', 'created_at'],
                'payments_org_status_index' => ['organization_id', 'status'],
            ],
            'customers' => [
                'customers_org_created_index' => ['organization_id', 'created_at'],
            ],
            'customer_timeline' => [
                'timeline_org_created_index' => ['organization_id', 'created_at'],
            ],
        ];
    }

    public function up(): void
    {
        foreach ($this->plan() as $table => $indexes) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            foreach ($indexes as $name => $columns) {
                // Skipped when it already exists so a half-applied run can be
                // re-run, and so environments that added one by hand are safe.
                if ($this->indexExists($name) || ! $this->hasColumns($table, $columns)) {
                    continue;
                }

                Schema::table($table, fn (Blueprint $t) => $t->index($columns, $name));
            }
        }
    }

    public function down(): void
    {
        foreach ($this->plan() as $table => $indexes) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            foreach (array_keys($indexes) as $name) {
                if ($this->indexExists($name)) {
                    Schema::table($table, fn (Blueprint $t) => $t->dropIndex($name));
                }
            }
        }
    }

    private function indexExists(string $name): bool
    {
        foreach (Schema::getConnection()->getSchemaBuilder()->getTables() as $table) {
            foreach (Schema::getIndexes($table['name']) as $index) {
                if (($index['name'] ?? null) === $name) {
                    return true;
                }
            }
        }

        return false;
    }

    private function hasColumns(string $table, array $columns): bool
    {
        foreach ($columns as $c) {
            if (! Schema::hasColumn($table, $c)) {
                return false;
            }
        }

        return true;
    }
};
