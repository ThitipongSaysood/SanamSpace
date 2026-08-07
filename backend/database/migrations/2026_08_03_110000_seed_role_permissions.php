<?php

use App\Support\RolePermissions;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Give roles something to actually mean.
 *
 * Roles and permissions existed as tables, an admin screen counted them — and
 * nothing anywhere ever read them. A "Viewer" could verify payments and delete
 * courts exactly like an Owner. This fills in the catalogue and gives every
 * system role a sensible default set, so `permission:` on the owner routes has
 * something truthful to check.
 *
 * The list lives in App\Support\RolePermissions so the seeder builds a fresh
 * database the same way this upgrades an existing one.
 */
return new class extends Migration
{
    public function up(): void
    {
        RolePermissions::install();
    }

    public function down(): void
    {
        // The catalogue rows stay: dropping them would cascade away whatever an
        // admin has since configured. Only the codes this migration introduced
        // are removed, and only when no role is using them.
        $preexisting = ['booking.view', 'booking.create', 'booking.cancel', 'payment.verify', 'court.manage'];

        foreach (array_diff(array_keys(RolePermissions::CATALOGUE), $preexisting) as $code) {
            $id = DB::table('permissions')->where('code', $code)->value('id');

            if ($id && ! DB::table('role_permissions')->where('permission_id', $id)->exists()) {
                DB::table('permissions')->where('id', $id)->delete();
            }
        }
    }
};
