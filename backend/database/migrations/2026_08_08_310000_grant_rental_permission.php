<?php

use App\Support\RolePermissions;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * `rental.manage` is new, so no role can have an opinion about it yet.
 * Granted to manager only, matching the defaults in RolePermissions —
 * reception and cashier can see what is out (that is `pos.sell`) but changing
 * how many rackets the venue owns is not counter work.
 */
return new class extends Migration
{
    public function up(): void
    {
        RolePermissions::install();

        $permissionId = DB::table('permissions')->where('code', 'rental.manage')->value('id');
        $roleId = DB::table('roles')->where('code', 'manager')->value('id');

        if (! $permissionId || ! $roleId) {
            return;
        }

        $exists = DB::table('role_permissions')
            ->where('role_id', $roleId)
            ->where('permission_id', $permissionId)
            ->exists();

        if (! $exists) {
            DB::table('role_permissions')->insert([
                'role_id' => $roleId,
                'permission_id' => $permissionId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        $id = DB::table('permissions')->where('code', 'rental.manage')->value('id');

        if ($id) {
            DB::table('role_permissions')->where('permission_id', $id)->delete();
            DB::table('permissions')->where('id', $id)->delete();
        }
    }
};
