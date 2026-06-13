<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Court;
use App\Models\Customer;
use App\Models\Feature;
use App\Models\Membership;
use App\Models\Notification;
use App\Models\Organization;
use App\Models\OrganizationSetting;
use App\Models\OrganizationUser;
use App\Models\Permission;
use App\Models\Plan;
use App\Models\Promotion;
use App\Models\Review;
use App\Models\Role;
use App\Models\Subscription;
use App\Models\User;
use App\Models\VenuePackage;
use App\Models\Wallet;
use App\Models\WalletTransaction;
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

        // Platform-level subscription catalogue (plans, features, mapping).
        $plans = $this->seedPlansAndFeatures();

        // Platform super admin (NOT tied to any organization).
        User::create([
            'name' => 'Platform Admin',
            'display_name' => 'Platform Admin',
            'email' => 'super@sanamspace.test',
            'password' => Hash::make('password'),
            'is_super_admin' => true,
        ]);

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
            // ReviewSummary.average / total (fixtures: 4.8 / 236).
            'rating' => 4.8,
            'review_count' => 236,
            'rating_breakdown' => [5 => 198, 4 => 28, 3 => 6, 2 => 3, 1 => 1],
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

        // --- Subscriptions: Everyday -> Pro (active), TSR -> Business (active) ---
        Subscription::create([
            'organization_id' => $everyday->id,
            'plan_id' => $plans['pro']->id,
            'status' => 'active',
            'started_at' => now()->subMonths(3),
            'ends_at' => null,
        ]);

        Subscription::create([
            'organization_id' => $tsr->id,
            'plan_id' => $plans['business']->id,
            'status' => 'active',
            'started_at' => now()->subMonth(),
            'ends_at' => null,
        ]);

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
        $customer = Customer::create([
            'organization_id' => $everyday->id,
            'line_user_id' => 'U1234567890abcdef1234567890abcdef',
            'display_name' => 'คุณสมชาย',
            'email' => 'example@email.com',
            'phone' => '081-234-5678',
            'total_spending' => 0,
            'visits' => 0,
        ]);

        $this->seedEverydayExtras($everyday, $everydayBranch, $customer);
    }

    /**
     * Seed the customer-app extras (reviews, packages, promotions, membership,
     * wallet, notifications) for Everyday Badminton, matching the frontend
     * fixtures (lib/api/fixtures.ts) exactly.
     */
    private function seedEverydayExtras(Organization $org, Branch $branch, Customer $customer): void
    {
        // --- Sample reviews (ReviewSummary.reviews) ---
        $reviews = [
            ['author' => 'ทานต์', 'rating' => 5, 'review_date' => '25 เม.ย. 2567', 'text' => 'สนามดีมาก แอร์เย็น สะอาด ห้องน้ำสะอาด เดินทางสะดวกครับ'],
            ['author' => 'บอล', 'rating' => 5, 'review_date' => '18 เม.ย. 2567', 'text' => 'ไฟสว่างดี พื้นสนามดีมากครับ'],
        ];
        foreach ($reviews as $i => $review) {
            Review::create(array_merge($review, [
                'organization_id' => $org->id,
                'branch_id' => $branch->id,
                'sort_order' => $i,
            ]));
        }

        // --- Packages (VenuePackage[]) ---
        $packages = [
            ['name' => 'แพ็กเกจ 10 ชม.', 'hours' => 10, 'price' => 2500, 'valid_days' => 90, 'save_percent' => 15],
            ['name' => 'แพ็กเกจ 20 ชม.', 'hours' => 20, 'price' => 4500, 'valid_days' => 120, 'save_percent' => 20],
            ['name' => 'แพ็กเกจ 50 ชม.', 'hours' => 50, 'price' => 10000, 'valid_days' => 180, 'save_percent' => 25],
        ];
        foreach ($packages as $i => $package) {
            VenuePackage::create(array_merge($package, [
                'organization_id' => $org->id,
                'sort_order' => $i,
            ]));
        }

        // --- Promotions (Promotion[]) ---
        $promotions = [
            ['title' => 'จองก่อน 16:00 น. ลด 10%', 'subtitle' => 'ทุกวัน จันทร์–ศุกร์', 'tag' => 'ส่วนลด'],
            ['title' => 'Happy Hour', 'subtitle' => '18:00–20:00', 'tag' => 'แพ็กเกจ'],
            ['title' => 'สมาชิก Gold ลดเพิ่ม 5%', 'subtitle' => 'ทุกการจอง', 'tag' => 'ส่วนลด'],
        ];
        foreach ($promotions as $i => $promotion) {
            Promotion::create(array_merge($promotion, [
                'organization_id' => $org->id,
                'sort_order' => $i,
            ]));
        }

        // --- Membership (Membership) ---
        Membership::create([
            'organization_id' => $org->id,
            'customer_id' => $customer->id,
            'tier' => 'Gold',
            'member_id' => 'ED-0001234',
            'points' => 820,
            'expires_at' => '31 ธ.ค. 2567',
            'benefits' => [
                'ส่วนลด 10% ทุกการจอง',
                'สะสมแต้ม 1 บาท = 1 คะแนน',
                'สิทธิ์จองล่วงหน้าก่อนใคร 1 วัน',
            ],
        ]);

        // --- Wallet + transactions (Wallet) ---
        $wallet = Wallet::create([
            'organization_id' => $org->id,
            'customer_id' => $customer->id,
            'balance' => 580,
        ]);
        $transactions = [
            ['txn_date' => '20 พ.ค.', 'label' => 'เติมเงิน', 'amount' => 500],
            ['txn_date' => '18 พ.ค.', 'label' => 'จอง Court 1', 'amount' => -225],
            ['txn_date' => '15 พ.ค.', 'label' => 'จอง Court 2', 'amount' => -225],
        ];
        foreach ($transactions as $i => $transaction) {
            WalletTransaction::create(array_merge($transaction, [
                'wallet_id' => $wallet->id,
                'sort_order' => $i,
            ]));
        }

        // --- Notifications (AppNotification[]) ---
        $notifications = [
            ['kind' => 'booking', 'title' => 'การจองสำเร็จ', 'body' => 'Court 1 วันที่ 25 พ.ค. 18:00', 'time_ago' => 'เมื่อสักครู่'],
            ['kind' => 'reminder', 'title' => 'เตือนความจำการจอง', 'body' => 'อย่าลืมการจองของคุณ Court 1 วันที่ 25 พ.ค. 18:00', 'time_ago' => '1 ชั่วโมงที่แล้ว'],
            ['kind' => 'promo', 'title' => 'โปรโมชั่นพิเศษ', 'body' => 'ลด 10% จองก่อน 16:00', 'time_ago' => '2 ชั่วโมงที่แล้ว'],
            ['kind' => 'points', 'title' => 'คะแนนเข้าแล้ว', 'body' => 'คุณได้รับ 225 คะแนน', 'time_ago' => '1 วันที่แล้ว'],
        ];
        foreach ($notifications as $i => $notification) {
            Notification::create(array_merge($notification, [
                'organization_id' => $org->id,
                'customer_id' => $customer->id,
                'sort_order' => $i,
            ]));
        }
    }

    /**
     * Seed the platform subscription catalogue from the Feature Matrix:
     * 4 plans (Starter/Business/Pro/Enterprise) with limits (∞ -> null),
     * a feature set, and the plan_features mapping.
     *
     * @return array<string,\App\Models\Plan> keyed by plan code
     */
    private function seedPlansAndFeatures(): array
    {
        // Limits per Feature Matrix; null = Unlimited (∞).
        $planDefs = [
            ['code' => 'starter', 'name' => 'Starter', 'price' => 990,
                'branch_limit' => 1, 'court_limit' => 10, 'staff_limit' => 5,
                'monthly_booking_limit' => 1000, 'storage_gb' => 5],
            ['code' => 'business', 'name' => 'Business', 'price' => 1990,
                'branch_limit' => 3, 'court_limit' => 30, 'staff_limit' => 15,
                'monthly_booking_limit' => 5000, 'storage_gb' => 20],
            ['code' => 'pro', 'name' => 'Pro', 'price' => 3990,
                'branch_limit' => null, 'court_limit' => null, 'staff_limit' => null,
                'monthly_booking_limit' => null, 'storage_gb' => 100],
            ['code' => 'enterprise', 'name' => 'Enterprise', 'price' => 0,
                'branch_limit' => null, 'court_limit' => null, 'staff_limit' => null,
                'monthly_booking_limit' => null, 'storage_gb' => null],
        ];

        $plans = [];
        foreach ($planDefs as $def) {
            $plans[$def['code']] = Plan::create(array_merge($def, [
                'interval' => 'month',
                'is_active' => true,
            ]));
        }

        // Feature catalogue (code => display name).
        $featureDefs = [
            'crm' => 'CRM',
            'membership' => 'Membership & Loyalty',
            'wallet' => 'Wallet',
            'package' => 'Package System',
            'broadcast' => 'Broadcast LINE',
            'payment_gateway' => 'Payment Gateway',
            'public_api' => 'Public API',
            'custom_domain' => 'Custom Domain',
            'tournament' => 'Tournament',
        ];

        $features = [];
        foreach ($featureDefs as $code => $name) {
            $features[$code] = Feature::create(['code' => $code, 'name' => $name]);
        }

        // plan_features mapping per the Feature Matrix (enabled by plan only;
        // Add-on entries are NOT enabled at the plan level).
        //   Starter   -> minimal (none of the gated features)
        //   Business  -> membership, wallet, package
        //   Pro       -> all
        //   Enterprise-> all
        $matrix = [
            'starter' => [],
            'business' => ['membership', 'wallet', 'package'],
            'pro' => ['crm', 'membership', 'wallet', 'package', 'broadcast', 'payment_gateway', 'public_api', 'custom_domain', 'tournament'],
            'enterprise' => ['crm', 'membership', 'wallet', 'package', 'broadcast', 'payment_gateway', 'public_api', 'custom_domain', 'tournament'],
        ];

        foreach ($matrix as $planCode => $featureCodes) {
            $sync = [];
            foreach ($featureCodes as $featureCode) {
                $sync[$features[$featureCode]->id] = ['enabled' => 1];
            }
            $plans[$planCode]->features()->sync($sync);
        }

        return $plans;
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
