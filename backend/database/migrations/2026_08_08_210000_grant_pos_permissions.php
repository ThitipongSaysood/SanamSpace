<?php

use App\Support\RolePermissions;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * POS is new, so no existing role can have an opinion about its permissions.
 *
 * `RolePermissions::install()` only fills roles that have nothing at all, which
 * is right for a fresh seed and wrong here. Granted explicitly instead, matching
 * the defaults in that class.
 *
 * Reception and cashier can sell but not void: putting a sale back changes the
 * day's takings, which is a supervisor's call.
 */
return new class extends Migration
{
    private const GRANTS = [
        'manager' => ['pos.sell', 'pos.void', 'product.manage'],
        'reception' => ['pos.sell'],
        'cashier' => ['pos.sell'],
    ];

    public function up(): void
    {
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
            ->whereIn('code', ['pos.sell', 'pos.void', 'product.manage'])
            ->pluck('id');

        DB::table('role_permissions')->whereIn('permission_id', $ids)->delete();
        DB::table('permissions')->whereIn('id', $ids)->delete();
    }
};
