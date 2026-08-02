<?php

use App\Support\RolePermissions;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * `booking.checkin` guards a route that did not exist before, so no role can
 * yet have an opinion about it.
 *
 * RolePermissions::install() only fills roles that have nothing at all, which is
 * right for the initial seed and wrong here — every role already has a set. So
 * the three front-desk roles are granted it explicitly, and only where it is
 * missing. Without this the feature would look broken: nobody but the venue's
 * owner could check anyone in.
 */
return new class extends Migration
{
    private const FRONT_DESK = ['manager', 'reception', 'cashier'];

    public function up(): void
    {
        // Writes the new catalogue entry (existing roles are left alone).
        RolePermissions::install();

        $permissionId = DB::table('permissions')->where('code', 'booking.checkin')->value('id');

        if (! $permissionId) {
            return;
        }

        foreach (self::FRONT_DESK as $code) {
            $roleId = DB::table('roles')->where('code', $code)->value('id');

            if (! $roleId) {
                continue;
            }

            $alreadyHas = DB::table('role_permissions')
                ->where('role_id', $roleId)
                ->where('permission_id', $permissionId)
                ->exists();

            if (! $alreadyHas) {
                DB::table('role_permissions')->insert([
                    'role_id' => $roleId,
                    'permission_id' => $permissionId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        $permissionId = DB::table('permissions')->where('code', 'booking.checkin')->value('id');

        if ($permissionId) {
            DB::table('role_permissions')->where('permission_id', $permissionId)->delete();
            DB::table('permissions')->where('id', $permissionId)->delete();
        }
    }
};
