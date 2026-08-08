<?php

use App\Support\RolePermissions;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The CRM routes were ungated until now, so no role can have an opinion about
 * the four new permissions yet.
 *
 * `RolePermissions::install()` only fills roles that have nothing at all, which
 * is right for a fresh seed and wrong here — every role already has a set. So
 * the new codes are granted explicitly, matching the defaults in that class,
 * and only where they are missing. Without this, gating the routes would take
 * the CRM away from every role except the venue's owner.
 *
 * `viewer` and `reception` get `crm.view` only: reading the customer list and
 * the broadcast history is part of front-desk work, sending marketing is not.
 */
return new class extends Migration
{
    /** role code => the new codes it should gain. */
    private const GRANTS = [
        'manager' => ['crm.view', 'crm.manage', 'segment.manage', 'broadcast.send'],
        'marketing' => ['crm.view', 'segment.manage', 'broadcast.send'],
        'reception' => ['crm.view'],
        'viewer' => ['crm.view'],
        'accountant' => ['crm.view'],
    ];

    public function up(): void
    {
        // Writes the new catalogue entries; existing role sets are left alone.
        RolePermissions::install();

        $ids = DB::table('permissions')->pluck('id', 'code');

        foreach (self::GRANTS as $roleCode => $codes) {
            $roleId = DB::table('roles')->where('code', $roleCode)->value('id');

            if (! $roleId) {
                continue;
            }

            foreach ($codes as $code) {
                if (! isset($ids[$code])) {
                    continue;
                }

                $exists = DB::table('role_permissions')
                    ->where('role_id', $roleId)
                    ->where('permission_id', $ids[$code])
                    ->exists();

                if (! $exists) {
                    // No id column value: role_permissions uses an auto-increment
                    // key, unlike the uuid tables it joins.
                    DB::table('role_permissions')->insert([
                        'role_id' => $roleId,
                        'permission_id' => $ids[$code],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        $ids = DB::table('permissions')
            ->whereIn('code', ['crm.view', 'crm.manage', 'segment.manage', 'broadcast.send'])
            ->pluck('id');

        DB::table('role_permissions')->whereIn('permission_id', $ids)->delete();
        DB::table('permissions')->whereIn('id', $ids)->delete();
    }
};
