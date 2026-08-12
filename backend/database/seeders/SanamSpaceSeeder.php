<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Broadcast;
use App\Models\Court;
use App\Models\Customer;
use App\Models\CustomerSegment;
use App\Models\CustomerTimelineEntry;
use App\Models\Feature;
use App\Models\Membership;
use App\Models\Notification;
use App\Models\Organization;
use App\Models\OrganizationSetting;
use App\Models\OrganizationUser;
use App\Models\Permission;
use App\Support\RolePermissions;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\Review;
use App\Models\Reward;
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
            'promptpay_id' => '0812345678',
            'promptpay_name' => 'Everyday Badminton',
            'bank_name' => 'กสิกรไทย',
            'bank_account_name' => 'บจก. เอฟเวอรี่เดย์ แบดมินตัน',
            'bank_account_number' => '123-4-56789-0',
            // The demo venue seeds rewards, memberships and a points ledger, so
            // leaving the programme switched off hid all of it — the customer
            // app hides the points UI when a venue does not run one.
            //
            // `self_redeem_enabled` deliberately stays OFF: redeeming from the
            // app rather than at the counter is a choice a venue makes, and
            // RewardTest asserts it is refused until they make it.
            'points_enabled' => true,
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
            'ends_at' => now()->addDays(18),
        ]);

        Subscription::create([
            'organization_id' => $tsr->id,
            'plan_id' => $plans['business']->id,
            'status' => 'active',
            'started_at' => now()->subMonth(),
            'ends_at' => now()->addDays(25),
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
        $this->seedRewards($everyday);

        // One demo venue per plan, each shaped like a venue on that plan really
        // is — see seedPlanShapes().
        $this->seedPlanShapes($everyday, $tsr, $plans, $ownerRole);
    }

    /**
     * Make each demo venue look like its plan.
     *
     * The three plans differ in exactly one visible way — how much a venue may
     * open — and every demo venue used to be one branch with a handful of
     * courts, so opening Starter and Pro side by side showed the same picture.
     * A demo that cannot tell ฿990 from ฿3,990 cannot be used to sell either.
     *
     * Sized against the plan's own limits (`plans.branch_limit` etc.), and
     * deliberately under them: a venue sitting exactly on its cap has no room
     * to demonstrate what happens when you add one more, which is the other
     * half of what the limits are for.
     *
     * Everyday Badminton keeps its original branch and its six courts exactly
     * as they were. Its whole customer history — bookings, CRM, wallet,
     * coupons — hangs off them, and so does most of the test suite.
     */
    private function seedPlanShapes(Organization $everyday, Organization $tsr, array $plans, ?Role $ownerRole): void
    {
        // --- Pro: unlimited, so it is the one with more than one branch ---
        $everydayNorth = Branch::create([
            'organization_id' => $everyday->id,
            'name' => 'Everyday Badminton · รัตนาธิเบศร์',
            'address' => 'ถนนรัตนาธิเบศร์ นนทบุรี',
            'phone' => '081-234-5679',
            'open_time' => '09:00',
            'close_time' => '23:00',
            'distance_km' => 3.4,
            'rating' => 4.7,
            'review_count' => 64,
            'sports' => ['badminton'],
            'facilities' => ['parking', 'shower', 'cafe', 'wifi', 'aircon'],
            'description' => 'สาขาที่สอง คอร์ทมาตรฐานเดียวกัน ที่จอดรถกว้างกว่า',
        ]);

        // sort_order continues past the first branch's six, so "the first
        // court" is still Court 1 for everything that asks for one.
        for ($i = 1; $i <= 4; $i++) {
            Court::create(array_merge([
                'organization_id' => $everyday->id,
                'branch_id' => $everydayNorth->id,
                'name' => "RTN {$i}",
                'sport' => 'badminton',
                'price_per_hour' => 280,
                'sort_order' => 10 + $i,
            ], self::BADMINTON_SPEC));
        }

        // --- Business: 3 branches / 30 courts. Show the multi-branch case. ---
        $tsrBranches = [
            ['name' => 'TSR Arena · ธัญบุรี', 'address' => 'ธัญบุรี ปทุมธานี', 'sports' => ['futsal'], 'courts' => [['ฟุตซอล A', 'futsal', 700], ['ฟุตซอล B', 'futsal', 700]]],
            ['name' => 'TSR Arena · รังสิต', 'address' => 'รังสิต ปทุมธานี', 'sports' => ['badminton', 'tabletennis'], 'courts' => [['RS 1', 'badminton', 240], ['RS 2', 'badminton', 240], ['โต๊ะปิงปอง 1', 'tabletennis', 120]]],
        ];

        foreach ($tsrBranches as $i => $def) {
            $branch = Branch::create([
                'organization_id' => $tsr->id,
                'name' => $def['name'],
                'address' => $def['address'],
                'open_time' => '09:00',
                'close_time' => '23:00',
                'distance_km' => 5.0 + $i,
                'rating' => 4.5,
                'review_count' => 40 + $i * 7,
                'sports' => $def['sports'],
                'facilities' => ['parking', 'cafe'],
            ]);

            foreach ($def['courts'] as $j => [$name, $sport, $price]) {
                Court::create([
                    'organization_id' => $tsr->id,
                    'branch_id' => $branch->id,
                    'name' => $name,
                    'sport' => $sport,
                    'price_per_hour' => $price,
                    'sort_order' => 20 + $i * 10 + $j,
                ]);
            }
        }

        $this->seedOwner($tsr, $ownerRole, 'TSR Owner', 'owner@tsr.test', '02-000-0000');

        // --- Starter: one branch, and that is the whole point of the tier ---
        $starter = Organization::create([
            'name' => 'แบดฮอลล์ ลาดพร้าว',
            'slug' => 'badhall-ladprao',
            'business_type' => 'badminton',
            'status' => 'active',
            'timezone' => 'Asia/Bangkok',
        ]);

        OrganizationSetting::create([
            'organization_id' => $starter->id,
            'primary_color' => '#EA580C',
            'secondary_color' => '#C2410C',
            'accent_color' => '#F97316',
            'phone' => '02-111-2222',
            'email' => 'contact@badhall.test',
            'address' => 'ลาดพร้าว กรุงเทพฯ',
            'timezone' => 'Asia/Bangkok',
            'promptpay_id' => '021112222',
            'promptpay_name' => 'แบดฮอลล์ ลาดพร้าว',
        ]);

        $starterBranch = Branch::create([
            'organization_id' => $starter->id,
            'name' => 'แบดฮอลล์ ลาดพร้าว',
            'address' => 'ลาดพร้าว กรุงเทพฯ',
            'phone' => '02-111-2222',
            'open_time' => '10:00',
            'close_time' => '22:00',
            'distance_km' => 4.8,
            'rating' => 4.4,
            'review_count' => 31,
            'sports' => ['badminton'],
            'facilities' => ['parking', 'wifi'],
            'description' => 'สนามแบดมินตันย่านลาดพร้าว 4 คอร์ท เปิดทุกวัน',
        ]);

        for ($i = 1; $i <= 4; $i++) {
            Court::create(array_merge([
                'organization_id' => $starter->id,
                'branch_id' => $starterBranch->id,
                'name' => "คอร์ท {$i}",
                'sport' => 'badminton',
                'price_per_hour' => 200,
                'sort_order' => $i,
            ], self::BADMINTON_SPEC));
        }

        Subscription::create([
            'organization_id' => $starter->id,
            'plan_id' => $plans['starter']->id,
            'status' => 'active',
            'started_at' => now()->subDays(12),
            'ends_at' => now()->addDays(18),
        ]);

        $this->seedOwner($starter, $ownerRole, 'Badhall Owner', 'owner@badhall.test', '02-111-2222');
    }

    /**
     * Things a customer can spend points on.
     *
     * There were none. The rewards screen, the redemption QR and the counter's
     * collection flow were all built, tested and shipped against rows that only
     * ever existed because somebody had created them by hand in the dev
     * database — the first `migrate:fresh` emptied the screen and failed the
     * e2e spec that had been passing on them for weeks.
     *
     * One of each type, so the demo shows all three ways a reward can pay out.
     */
    private function seedRewards(Organization $org): void
    {
        // A product reward needs a product behind it — without one the app
        // renders it "ของหมด" and the button is dead, which is exactly how the
        // seeded catalogue looked before: three rewards, one of them unusable.
        $water = Product::create([
            'organization_id' => $org->id,
            'name' => 'น้ำดื่ม',
            'category' => 'เครื่องดื่ม',
            'price' => 15,
            'stock_qty' => 120,
            'low_stock_threshold' => 20,
            'is_active' => true,
            'sort_order' => 1,
        ]);

        Product::create([
            'organization_id' => $org->id,
            'name' => 'ลูกขนไก่ (หลอด)',
            'category' => 'อุปกรณ์',
            'price' => 450,
            'stock_qty' => 24,
            'low_stock_threshold' => 5,
            'is_active' => true,
            'sort_order' => 2,
        ]);

        $rewards = [
            ['name' => 'น้ำดื่ม 1 ขวด', 'points_cost' => 50, 'type' => 'product', 'product_id' => $water->id, 'credit_amount' => null, 'hours' => null],
            ['name' => 'ส่วนลด 100 บาท', 'points_cost' => 150, 'type' => 'credit', 'product_id' => null, 'credit_amount' => 100, 'hours' => null],
            ['name' => 'เล่นฟรี 1 ชั่วโมง', 'points_cost' => 300, 'type' => 'hours', 'product_id' => null, 'credit_amount' => null, 'hours' => 1],
        ];

        foreach ($rewards as $i => $reward) {
            Reward::create($reward + [
                'organization_id' => $org->id,
                'is_active' => true,
                'sort_order' => $i + 1,
            ]);
        }
    }

    /** A venue with no owner cannot be opened, which makes it a poor demo. */
    private function seedOwner(Organization $org, ?Role $ownerRole, string $name, string $email, string $phone): void
    {
        $user = User::create([
            'name' => $name,
            'display_name' => $name,
            'email' => $email,
            'phone' => $phone,
            'password' => Hash::make('password'),
        ]);

        OrganizationUser::create([
            'organization_id' => $org->id,
            'user_id' => $user->id,
            'role_id' => $ownerRole?->id,
            'display_name' => $name,
            'status' => 'active',
            'joined_at' => now(),
        ]);
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
            'expires_on' => '2024-12-31',
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

        $this->seedEverydayCrm($org, $customer);
    }

    /**
     * Seed the CRM domain (segments, segment membership, customer timeline,
     * broadcasts) for Everyday Badminton.
     */
    private function seedEverydayCrm(Organization $org, Customer $customer): void
    {
        // --- Segments: VIP, inactive-30d, new-members ---
        $vip = CustomerSegment::create([
            'organization_id' => $org->id,
            'name' => 'VIP',
            'description' => 'ลูกค้าที่ใช้จ่ายสูงและมาประจำ',
        ]);
        $inactive = CustomerSegment::create([
            'organization_id' => $org->id,
            'name' => 'ไม่เคลื่อนไหว 30 วัน',
            'description' => 'ลูกค้าที่ไม่มีการจองในรอบ 30 วัน',
        ]);
        CustomerSegment::create([
            'organization_id' => $org->id,
            'name' => 'สมาชิกใหม่',
            'description' => 'ลูกค้าที่สมัครภายใน 30 วันล่าสุด',
        ]);

        // The demo customer is a VIP.
        $vip->members()->attach($customer->id);

        // --- Timeline for the demo customer (newest occurred_at last in list) ---
        $timeline = [
            ['type' => 'signup', 'title' => 'สมัครสมาชิก', 'description' => 'เข้าร่วมผ่าน LINE', 'occurred_at' => now()->subDays(40)],
            ['type' => 'booking', 'title' => 'จอง Court 1', 'description' => '18:00–19:00', 'occurred_at' => now()->subDays(20)],
            ['type' => 'payment', 'title' => 'ชำระเงิน 225 บาท', 'description' => 'โอนผ่าน PromptPay', 'occurred_at' => now()->subDays(20)],
            ['type' => 'points', 'title' => 'ได้รับ 225 คะแนน', 'description' => 'จากการจอง Court 1', 'occurred_at' => now()->subDays(19)],
        ];
        foreach ($timeline as $entry) {
            CustomerTimelineEntry::create(array_merge($entry, [
                'organization_id' => $org->id,
                'customer_id' => $customer->id,
            ]));
        }

        // --- Broadcasts: 1 sent, 1 draft ---
        Broadcast::create([
            'organization_id' => $org->id,
            'title' => 'โปรโมชั่น Happy Hour',
            'message' => 'ลด 10% สำหรับการจองช่วง 18:00–20:00 ทุกวันจันทร์–ศุกร์',
            'channel' => 'line',
            'segment_id' => $vip->id,
            'status' => 'sent',
            'recipient_count' => 1,
            'sent_at' => now()->subDays(5),
        ]);
        Broadcast::create([
            'organization_id' => $org->id,
            'title' => 'แจ้งเตือนสมาชิกที่หายไป',
            'message' => 'คิดถึงคุณ! กลับมาเล่นกับเรารับส่วนลดพิเศษ',
            'channel' => 'email',
            'segment_id' => $inactive->id,
            'status' => 'draft',
            'recipient_count' => 0,
        ]);
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
        ];

        $plans = [];
        foreach ($planDefs as $def) {
            $plans[$def['code']] = Plan::create(array_merge($def, [
                'interval' => 'month',
                'is_active' => true,
            ]));
        }

        // The catalogue lives in one place — see PlanCatalogue. It used to be
        // duplicated here and on the pricing page, and two lists of what a
        // customer is paying for drift.
        $features = [];
        foreach (\App\Support\PlanCatalogue::FEATURES as $code => [$name, $planCodes]) {
            // updateOrCreate, not create: migrations already write this
            // catalogue for existing installs, so a fresh seed on top of them
            // must not collide on the unique code.
            $features[$code] = Feature::updateOrCreate(['code' => $code], ['name' => $name]);
        }

        foreach ($plans as $planCode => $plan) {
            $sync = [];
            foreach (\App\Support\PlanCatalogue::forPlan($planCode) as $featureCode) {
                $sync[$features[$featureCode]->id] = ['enabled' => 1];
            }
            $plan->features()->sync($sync);
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

        // The catalogue and each role's defaults, from the same definition the
        // upgrade migration uses — two copies of this list is how the two
        // environments end up disagreeing about what a Cashier may do.
        RolePermissions::install();

        // Owner is listed for display, but bypasses the check in practice.
        Role::where('code', 'owner')->first()?->permissions()->sync(Permission::pluck('id'));
    }
}
