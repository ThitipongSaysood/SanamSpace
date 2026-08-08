<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The permission catalogue and each system role's default set.
 *
 * One definition, two callers: the migration that upgrades an existing database
 * and the seeder that builds a fresh one. Keeping the list in both places is
 * how they drift apart, and a role whose defaults differ between environments
 * is worse than no defaults at all.
 *
 * Enforced by the `permission:` middleware on the owner routes — before that,
 * a "Viewer" could verify payments exactly like an Owner.
 */
final class RolePermissions
{
    /** code => [name, module] */
    public const CATALOGUE = [
        'booking.view' => ['View bookings', 'booking'],
        'booking.create' => ['Create bookings', 'booking'],
        'booking.cancel' => ['Cancel bookings', 'booking'],
        'booking.checkin' => ['Check customers in', 'booking'],
        'payment.verify' => ['Verify payments', 'payment'],
        'refund.manage' => ['Approve refunds', 'payment'],
        'wallet.manage' => ['Adjust customer wallets', 'payment'],
        'court.manage' => ['Manage courts and branches', 'court'],
        'pos.sell' => ['Sell at the counter', 'pos'],
        'pos.void' => ['Void a sale', 'pos'],
        'product.manage' => ['Manage products and stock', 'pos'],
        'customer.view' => ['View customers', 'customer'],
        'crm.view' => ['View CRM, segments and broadcasts', 'customer'],
        'crm.manage' => ['Adjust membership points', 'customer'],
        'segment.manage' => ['Create and delete segments', 'marketing'],
        'broadcast.send' => ['Send marketing broadcasts', 'marketing'],
        'promotion.manage' => ['Manage promotions and banners', 'marketing'],
        'report.view' => ['View reports', 'report'],
        'staff.manage' => ['Manage staff', 'settings'],
        'settings.manage' => ['Change venue settings', 'settings'],
    ];

    /**
     * role code => permission codes.
     *
     * Deliberately close to what each role could already do in practice, minus
     * the things that move money or change the venue's setup.
     *
     * `owner` and `super_admin` are absent on purpose: both bypass the check, so
     * a list for them would be a lie — and a tempting one to empty.
     */
    public const DEFAULTS = [
        'manager' => [
            'booking.view', 'booking.create', 'booking.cancel', 'booking.checkin', 'payment.verify', 'refund.manage',
            'wallet.manage', 'court.manage', 'pos.sell', 'pos.void', 'product.manage',
            'customer.view', 'crm.view', 'crm.manage',
            'segment.manage', 'broadcast.send', 'promotion.manage', 'report.view',
        ],
        'reception' => [
            'booking.view', 'booking.create', 'booking.cancel', 'booking.checkin', 'pos.sell',
            'customer.view', 'crm.view',
        ],
        'cashier' => ['booking.view', 'booking.checkin', 'payment.verify', 'pos.sell', 'customer.view'],
        'marketing' => [
            'booking.view', 'customer.view', 'crm.view', 'segment.manage', 'broadcast.send',
            'promotion.manage', 'report.view',
        ],
        'accountant' => ['booking.view', 'payment.verify', 'report.view', 'customer.view'],
        'viewer' => ['booking.view', 'customer.view', 'crm.view', 'report.view'],
    ];

    /**
     * Write the catalogue, then fill in defaults for roles nobody has
     * configured yet. Safe to run repeatedly; never overwrites a choice an
     * admin has already made.
     */
    public static function install(): void
    {
        $now = now();

        // Inserted by hand rather than updateOrInsert: the table has a uuid
        // primary key with no database default, so a blind insert leaves a blank.
        foreach (self::CATALOGUE as $code => [$name, $module]) {
            if (DB::table('permissions')->where('code', $code)->exists()) {
                DB::table('permissions')->where('code', $code)
                    ->update(['name' => $name, 'module' => $module, 'updated_at' => $now]);

                continue;
            }

            DB::table('permissions')->insert([
                'id' => (string) Str::uuid(),
                'code' => $code,
                'name' => $name,
                'module' => $module,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $permissionIds = DB::table('permissions')->pluck('id', 'code');

        foreach (self::DEFAULTS as $roleCode => $codes) {
            $roleId = DB::table('roles')->where('code', $roleCode)->value('id');

            if (! $roleId || DB::table('role_permissions')->where('role_id', $roleId)->exists()) {
                continue;
            }

            foreach ($codes as $code) {
                if (isset($permissionIds[$code])) {
                    // No id: role_permissions uses an auto-increment key, unlike
                    // the uuid tables it joins.
                    DB::table('role_permissions')->insert([
                        'role_id' => $roleId,
                        'permission_id' => $permissionIds[$code],
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }
        }
    }
}
