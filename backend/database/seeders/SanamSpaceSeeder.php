<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Court;
use App\Models\Customer;
use App\Models\Organization;
use App\Models\OrganizationSetting;
use App\Models\OrganizationUser;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SanamSpaceSeeder extends Seeder
{
    /** Badminton court spec shared by Everyday Badminton courts. */
    private const BADMINTON_SPEC = [
        'floor' => 'PVC',
        'aircon' => 'มี',
        'height' => '12 เมตร',
        'lighting' => 'LED',
        'standard' => 'BWF',
        'players' => '2-4 คน',
    ];

    public function run(): void
    {
        $this->seedRolesAndPermissions();

        // --- Org 1: Everyday Badminton ---
        $everyday = Organization::create([
            'name' => 'Everyday Badminton',
            'slug' => 'everyday-badminton',
            'business_type' => 'badminton',
            'status' => 'active',
            'timezone' => 'Asia/Bangkok',
        ]);

        OrganizationSetting::create([
            'organization_id' => $everyday->id,
            'primary_color' => '#16A34A',
            'secondary_color' => '#15803D',
            'accent_color' => '#22C55E',
            'font_family' => 'Inter',
            'phone' => '081-234-5678',
            'email' => 'contact@everyday.test',
            'address' => 'ถนนงามวงศ์วาน นนทบุรี',
            'timezone' => 'Asia/Bangkok',
        ]);

        $everydayBranch = Branch::create([
            'organization_id' => $everyday->id,
            'name' => 'Everyday Badminton',
            'address' => 'ถนนงามวงศ์วาน นนทบุรี',
            'phone' => '081-234-5678',
            'open_time' => '10:00',
            'close_time' => '22:00',
            'distance_km' => 1.2,
            'rating' => 4.8,
            'review_count' => 124,
            'image_url' => '/venues/everyday.jpg',
            'sports' => ['badminton'],
            'facilities' => ['parking', 'shower', 'cafe', 'wifi', 'aircon'],
            'travel_hint' => '15 นาทีจาก MRT บางรักน้อย-ท่าอิฐ',
            'peak_note' => '18:00–22:00 สนามเต็มเร็วมาก แนะนำให้จองล่วงหน้า',
            'description' => 'สนามแบดมินตันมาตรฐาน พื้นไม้ไร้แรงสะท้อน รองรับทุกระดับการเล่น พร้อมสิ่งอำนวยความสะดวกครบครัน',
            'week_hours' => [
                ['day' => 'จันทร์', 'open' => '08:00', 'close' => '24:00'],
                ['day' => 'อังคาร', 'open' => '08:00', 'close' => '24:00'],
                ['day' => 'พุธ', 'open' => '08:00', 'close' => '24:00'],
                ['day' => 'พฤหัสบดี', 'open' => '08:00', 'close' => '24:00'],
                ['day' => 'ศุกร์', 'open' => '08:00', 'close' => '24:00'],
                ['day' => 'เสาร์', 'open' => '07:00', 'close' => '24:00'],
                ['day' => 'อาทิตย์', 'open' => '07:00', 'close' => '24:00'],
            ],
        ]);

        for ($i = 1; $i <= 6; $i++) {
            Court::create(array_merge([
                'organization_id' => $everyday->id,
                'branch_id' => $everydayBranch->id,
                'name' => "Court {$i}",
                'sport' => 'badminton',
                'price_per_hour' => 250,
                'sort_order' => $i,
            ], self::BADMINTON_SPEC));
        }

        // --- Org 2: TSR Arena ---
        $tsr = Organization::create([
            'name' => 'TSR Arena',
            'slug' => 'tsr-arena',
            'business_type' => 'multi-sport',
            'status' => 'active',
            'timezone' => 'Asia/Bangkok',
        ]);

        OrganizationSetting::create([
            'organization_id' => $tsr->id,
            'primary_color' => '#2563EB',
            'phone' => '02-000-0000',
            'address' => 'ปทุมธานี',
            'timezone' => 'Asia/Bangkok',
        ]);

        $tsrBranch = Branch::create([
            'organization_id' => $tsr->id,
            'name' => 'TSR Arena',
            'address' => 'ปทุมธานี',
            'open_time' => '09:00',
            'close_time' => '23:00',
            'distance_km' => 2.1,
            'rating' => 4.6,
            'review_count' => 88,
            'image_url' => '/venues/tsr.jpg',
            'sports' => ['badminton', 'futsal'],
            'facilities' => ['parking', 'cafe'],
        ]);

        // 4 courts: first two badminton (220), last two futsal (600).
        for ($i = 1; $i <= 4; $i++) {
            $isBadminton = $i <= 2;
            Court::create([
                'organization_id' => $tsr->id,
                'branch_id' => $tsrBranch->id,
                'name' => "Court {$i}",
                'sport' => $isBadminton ? 'badminton' : 'futsal',
                'price_per_hour' => $isBadminton ? 220 : 600,
                'sort_order' => $i,
            ]);
        }

        // --- Demo owner user for Everyday Badminton ---
        $ownerRole = Role::where('code', 'owner')->first();
        $owner = User::create([
            'name' => 'Everyday Owner',
            'display_name' => 'Everyday Owner',
            'email' => 'owner@everyday.test',
            'phone' => '081-234-5678',
            'password' => Hash::make('password'),
        ]);

        OrganizationUser::create([
            'organization_id' => $everyday->id,
            'user_id' => $owner->id,
            'role_id' => $ownerRole?->id,
            'display_name' => 'Everyday Owner',
            'status' => 'active',
            'joined_at' => now(),
        ]);

        // --- Demo customer ---
        Customer::create([
            'organization_id' => $everyday->id,
            'line_user_id' => 'U1234567890abcdef1234567890abcdef',
            'display_name' => 'คุณสมชาย',
            'email' => 'example@email.com',
            'phone' => '081-234-5678',
            'total_spending' => 0,
            'visits' => 0,
        ]);
    }

    private function seedRolesAndPermissions(): void
    {
        $roles = [
            ['code' => 'super_admin', 'name' => 'Super Admin', 'is_system_role' => true],
            ['code' => 'owner', 'name' => 'Owner', 'is_system_role' => true],
            ['code' => 'manager', 'name' => 'Manager', 'is_system_role' => true],
            ['code' => 'reception', 'name' => 'Reception', 'is_system_role' => true],
            ['code' => 'cashier', 'name' => 'Cashier', 'is_system_role' => true],
            ['code' => 'marketing', 'name' => 'Marketing', 'is_system_role' => true],
            ['code' => 'accountant', 'name' => 'Accountant', 'is_system_role' => true],
            ['code' => 'viewer', 'name' => 'Viewer', 'is_system_role' => true],
        ];

        foreach ($roles as $role) {
            Role::create($role);
        }

        // A small starter set of permissions, enough to be present.
        $permissions = [
            ['code' => 'booking.view', 'name' => 'View bookings', 'module' => 'booking'],
            ['code' => 'booking.create', 'name' => 'Create bookings', 'module' => 'booking'],
            ['code' => 'booking.cancel', 'name' => 'Cancel bookings', 'module' => 'booking'],
            ['code' => 'payment.verify', 'name' => 'Verify payments', 'module' => 'payment'],
            ['code' => 'court.manage', 'name' => 'Manage courts', 'module' => 'court'],
        ];

        $created = collect($permissions)->map(fn ($p) => Permission::create($p));

        // Owner gets every permission.
        Role::where('code', 'owner')->first()?->permissions()->sync($created->pluck('id'));
    }
}
