<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\Court;
use App\Models\Organization;
use App\Models\Payment;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * A small, readable set of demo data — one handful of everything.
 *
 * Replaces the 3,000-row load-test pile, which made every list unreadable and
 * every screenshot meaningless. Small enough to hold in your head, wide enough
 * that every status filter, every queue and every new feature has something in
 * it: a slip to review, gear that has not come back, a voided bill, a booking
 * with a balance owing, a live segment.
 *
 * Destructive: wipes bookings, payments, sales, rentals and coupons first.
 * Dev/demo only.
 */
class DemoBookingsSeeder extends Seeder
{
    /** These bookings belong to whoever the customer app logs in as. */
    private const LINE_CUSTOMER_ROWS = ['คุณสมชาย ใจดี', 'คุณอนันต์ มาแล้ว', 'คุณชูใจ แบดมินตัน'];

    /**
     * The LINE id the dev stub login uses (frontend `lib/auth/auth-context.tsx`).
     *
     * Named explicitly rather than "any customer with a line id": this venue has
     * more than one, and giving the demo bookings to the wrong one leaves the
     * customer app showing an empty booking list.
     */
    private const DEMO_LINE_USER_ID = 'Uxxxx';

    public function run(): void
    {
        $org = Organization::where('slug', 'everyday-badminton')->first();

        if (! $org) {
            $this->command?->warn('everyday-badminton not found — nothing seeded.');

            return;
        }

        $this->wipe();

        $courts = Court::query()->forOrganization($org->id)->orderBy('name')->get()->values();
        $customers = $this->customers($org);
        // The venue's wall clock, not the app's UTC — these are times staff read.
        $today = now()->timezone($org->settings?->timezone ?: 'Asia/Bangkok')->startOfDay();

        $rows = [
            // status,             day offset, start, court, customer, extra
            ['confirmed', 0, '18:00', 0, 'คุณสมชาย ใจดี', []],
            ['confirmed', 0, '19:00', 1, 'คุณมานี รักกีฬา', []],
            ['confirmed', 1, '17:00', 2, 'คุณปิติ ตีลูกขนไก่', []],
            ['confirmed', 2, '20:00', 0, 'คุณชูใจ แบดมินตัน', []],

            // Waiting for money: one with no slip yet, one with a slip to review.
            ['pending_payment', 1, '10:00', 3, 'คุณวีระ ยังไม่จ่าย', []],
            ['pending_payment', 2, '11:00', 4, 'คุณสมหญิง ส่งสลิปแล้ว', ['slip' => true]],

            // Already played. One of them was scanned in at the counter.
            ['completed', -1, '18:00', 0, 'คุณอนันต์ มาแล้ว', ['checkedIn' => true, 'paid' => true]],
            ['completed', -2, '19:00', 1, 'คุณกมล เล่นเสร็จ', ['paid' => true]],

            // Called off.
            ['cancelled', 1, '09:00', 5, 'คุณดวงใจ ยกเลิก', []],
            ['cancelled', -1, '20:00', 2, 'คุณเอกชัย ไม่ว่าง', []],
        ];

        foreach ($rows as $i => [$status, $dayOffset, $start, $courtIndex, $name, $extra]) {
            $court = $courts[$courtIndex % max(1, $courts->count())] ?? null;
            if (! $court) {
                continue;
            }

            $date = $today->copy()->addDays($dayOffset);
            $end = Carbon::createFromFormat('H:i', $start)->addHour()->format('H:i');
            $amount = (float) ($court->price_per_hour ?: 250);

            $booking = Booking::create([
                'organization_id' => $org->id,
                'branch_id' => $court->branch_id,
                'court_id' => $court->id,
                'customer_id' => $this->customerFor($org, $customers, $name)->id,
                'code' => 'BK'.$date->format('ymd').str_pad((string) ($i + 1), 3, '0', STR_PAD_LEFT),
                'date' => $date->toDateString(),
                'start' => $start,
                'end' => $end,
                'amount' => $amount,
                'court_amount' => $amount,
                // Confirmed and completed mean the money is in. Left at 0 they
                // would each show a false "ค้างชำระ" and a cash button on a
                // booking that owes nothing.
                'paid_amount' => in_array($status, ['confirmed', 'completed'], true) ? $amount : 0,
                'status' => $status,
                'channel' => $i % 3 === 0 ? 'walk_in' : 'application',
                'checked_in_at' => ! empty($extra['checkedIn']) ? $date->copy()->setTimeFromTimeString($start) : null,
            ]);

            if (! empty($extra['paid'])) {
                $this->payment($org, $booking, 'approved');
            }

            // The one slip the ตรวจสลิป queue has to review.
            if (! empty($extra['slip'])) {
                $this->payment($org, $booking, 'pending_review', $this->anySlipUrl());
            }
        }

        $this->command?->info('Seeded '.count($rows).' demo bookings across every status.');

        $this->seedShop($org);
        $this->seedRentals($org, $courts, $customers, $today);
        $this->seedCoupons($org);
        $this->seedDeposit($org, $courts, $customers, $today);
        $this->seedSegments($org);
    }

    /**
     * Clear the transactional tables this seeder owns.
     *
     * Deliberately not the venue, courts, staff or settings — those are the
     * setup someone configured, not demo clutter, and wiping them would lock
     * the owner out of their own portal.
     */
    private function wipe(): void
    {
        \App\Models\CouponRedemption::query()->delete();
        \App\Models\Coupon::withTrashed()->forceDelete();
        \App\Models\ProductSaleItem::query()->delete();
        \App\Models\ProductSale::query()->delete();
        \App\Models\BookingRental::query()->delete();
        // The catalogues too: this seeder creates them, so without a wipe a
        // second run leaves two of every racket and five more bottles of water.
        \App\Models\Product::withTrashed()->forceDelete();
        \App\Models\RentalItem::withTrashed()->forceDelete();
        \App\Models\BroadcastRecipient::query()->delete();
        Payment::query()->forceDelete();
        Booking::withTrashed()->forceDelete();
        // Written by observers as the rows above are recreated, so the old
        // entries would otherwise pile up alongside the new ones.
        \App\Models\CustomerTimelineEntry::query()->delete();
    }

    /** The till: things to sell, and a day's takings including one void. */
    private function seedShop(Organization $org): void
    {
        $products = [
            ['name' => 'น้ำเปล่า 600ml', 'price' => 15, 'stock_qty' => 48],
            ['name' => 'น้ำอัดลม', 'price' => 20, 'stock_qty' => 24],
            ['name' => 'เกลือแร่', 'price' => 25, 'stock_qty' => 18],
            // Low on purpose, so the "ของใกล้หมด" warning has something to warn about.
            ['name' => 'ลูกขนไก่ (หลอด)', 'price' => 380, 'stock_qty' => 2],
            ['name' => 'ผ้าเช็ดตัว', 'price' => 120, 'stock_qty' => 10],
        ];

        $made = collect($products)->map(fn ($p, $i) => \App\Models\Product::create($p + [
            'organization_id' => $org->id,
            'is_active' => true,
            'sort_order' => $i,
        ]));

        $seller = \App\Models\User::query()
            ->whereHas('organizationUsers', fn ($q) => $q->where('organization_id', $org->id))
            ->first();

        $today = now()->timezone($org->settings?->timezone ?: 'Asia/Bangkok');

        // Three real sales and one voided, because "we voided one today" is a
        // number the till screen is built to show.
        $sales = [
            [[0 => 2, 2 => 1], 'cash', 'completed'],
            [[1 => 1], 'transfer', 'completed'],
            [[4 => 1], 'cash', 'completed'],
            [[3 => 1], 'cash', 'voided'],
        ];

        foreach ($sales as $i => [$lines, $method, $status]) {
            $sale = \App\Models\ProductSale::create([
                'organization_id' => $org->id,
                'code' => 'SL'.$today->format('ymd').str_pad((string) ($i + 1), 3, '0', STR_PAD_LEFT),
                'sold_by' => $seller?->id,
                'payment_method' => $method,
                'status' => $status,
                'total' => 0,
                'sold_at' => $today->copy()->subHours(6 - $i),
                'voided_at' => $status === 'voided' ? $today->copy()->subHours(1) : null,
                'void_reason' => $status === 'voided' ? 'คิดเงินผิดรายการ' : null,
            ]);

            $total = 0;
            foreach ($lines as $index => $qty) {
                $product = $made[$index];
                $lineTotal = (float) $product->price * $qty;
                $total += $lineTotal;

                \App\Models\ProductSaleItem::create([
                    'product_sale_id' => $sale->id,
                    'product_id' => $product->id,
                    'name' => $product->name,
                    'unit_price' => $product->price,
                    'quantity' => $qty,
                    'line_total' => $lineTotal,
                ]);
            }

            $sale->update(['total' => $total]);
        }
    }

    /** Equipment, and one set that has not come back yet. */
    private function seedRentals(Organization $org, $courts, $customers, Carbon $today): void
    {
        $items = collect([
            ['name' => 'ไม้แบดมินตัน', 'price' => 50, 'price_unit' => 'per_session', 'stock_qty' => 8, 'note' => 'มัดจำ 500 บาท คืนเมื่อส่งคืน'],
            ['name' => 'รองเท้าแบด', 'price' => 40, 'price_unit' => 'per_session', 'stock_qty' => 6, 'note' => 'มีไซซ์ 39–45'],
            ['name' => 'เครื่องยิงลูก', 'price' => 200, 'price_unit' => 'per_hour', 'stock_qty' => 1, 'note' => 'จองล่วงหน้าแนะนำ'],
        ])->map(fn ($item, $i) => \App\Models\RentalItem::create($item + [
            'organization_id' => $org->id,
            'is_active' => true,
            'sort_order' => $i,
        ]));

        $court = $courts->first();
        if (! $court) {
            return;
        }

        // Yesterday, so it lands on the "ยังไม่ได้คืน" chase list rather than
        // reading as gear that is simply in use right now.
        $yesterday = $today->copy()->subDay();

        $booking = Booking::create([
            'organization_id' => $org->id,
            'branch_id' => $court->branch_id,
            'court_id' => $court->id,
            'customer_id' => $this->customerFor($org, $customers, 'คุณธนา ยืมไม้')->id,
            'code' => 'BK'.$yesterday->format('ymd').'900',
            'date' => $yesterday->toDateString(),
            'start' => '16:00',
            'end' => '17:00',
            'court_amount' => 250,
            'rental_total' => 100,
            'amount' => 350,
            'paid_amount' => 350,
            'status' => 'completed',
            'channel' => 'application',
        ]);

        \App\Models\BookingRental::create([
            'booking_id' => $booking->id,
            'rental_item_id' => $items[0]->id,
            'name' => $items[0]->name,
            'unit_price' => 50,
            'price_unit' => 'per_session',
            'quantity' => 2,
            'returned_qty' => 1, // half back — a real counter moment
            'hours' => 1,
            'line_total' => 100,
        ]);

        $this->payment($org, $booking, 'approved');
    }

    /** Two codes: one plain, one with every limit set. */
    private function seedCoupons(Organization $org): void
    {
        \App\Models\Coupon::create([
            'organization_id' => $org->id,
            'code' => 'SANAM10',
            'description' => 'ลด 10% ทุกคอร์ท',
            'type' => 'percent',
            'value' => 10,
            'per_customer_limit' => 5,
            'is_active' => true,
        ]);

        \App\Models\Coupon::create([
            'organization_id' => $org->id,
            'code' => 'FIRST100',
            'description' => 'ลูกค้าใหม่ ลด 100 บาท (ยอดขั้นต่ำ 300)',
            'type' => 'fixed',
            'value' => 100,
            'min_amount' => 300,
            'usage_limit' => 50,
            'per_customer_limit' => 1,
            'ends_at' => now()->addMonths(2)->toDateString(),
            'is_active' => true,
        ]);
    }

    /**
     * One booking that paid a deposit and still owes a balance.
     *
     * Seeded with the setting left OFF: this is what an existing deposit
     * booking looks like, without forcing every other demo booking to become
     * one.
     */
    private function seedDeposit(Organization $org, $courts, $customers, Carbon $today): void
    {
        $court = $courts[1] ?? $courts->first();
        if (! $court) {
            return;
        }

        $date = $today->copy()->addDays(3);

        $booking = Booking::create([
            'organization_id' => $org->id,
            'branch_id' => $court->branch_id,
            'court_id' => $court->id,
            'customer_id' => $this->customerFor($org, $customers, 'คุณนภา จ่ายมัดจำ')->id,
            'code' => 'BK'.$date->format('ymd').'901',
            'date' => $date->toDateString(),
            'start' => '19:00',
            'end' => '21:00',
            'court_amount' => 500,
            'amount' => 500,
            'deposit_amount' => 150,
            'paid_amount' => 150,
            'status' => 'confirmed',
            'channel' => 'application',
        ]);

        Payment::create([
            'organization_id' => $org->id,
            'booking_id' => $booking->id,
            'customer_id' => $booking->customer_id,
            'method' => 'transfer',
            'amount' => 150,
            'status' => 'approved',
        ]);
    }

    /** A segment that maintains itself, next to the hand-picked ones. */
    private function seedSegments(Organization $org): void
    {
        \App\Models\CustomerSegment::updateOrCreate(
            ['organization_id' => $org->id, 'name' => 'ขาประจำ (อัตโนมัติ)'],
            [
                'description' => 'จองตั้งแต่ 2 ครั้งขึ้นไป — อัปเดตสมาชิกเอง',
                'criteria' => ['minBookings' => 2],
            ],
        );

        \App\Models\CustomerSegment::updateOrCreate(
            ['organization_id' => $org->id, 'name' => 'หายไปนาน (อัตโนมัติ)'],
            [
                'description' => 'เคยจอง แต่ไม่กลับมา 60 วัน',
                'criteria' => ['notBookedForDays' => 60],
            ],
        );
    }

    /** @return \Illuminate\Support\Collection<int, Customer> */
    private function customers(Organization $org)
    {
        return Customer::query()->forOrganization($org->id)->get();
    }

    /**
     * Reuse a customer with this name, or add one so the list has real variety.
     *
     * The first few bookings go to the LINE-linked demo customer instead — the
     * customer app signs in as them, and a demo app with an empty booking list
     * shows nothing worth looking at.
     */
    private function customerFor(Organization $org, $customers, string $name): Customer
    {
        if (in_array($name, self::LINE_CUSTOMER_ROWS, true)) {
            // Created rather than looked up: on a freshly reset database nobody
            // has signed in yet, so this customer does not exist and the demo
            // bookings would land on someone the app never logs in as —
            // leaving the customer app with an empty list on a full database.
            return Customer::firstOrCreate(
                ['organization_id' => $org->id, 'line_user_id' => self::DEMO_LINE_USER_ID],
                ['display_name' => 'คุณสมชาย ใจดี', 'phone' => '0812345678'],
            );
        }

        $existing = $customers->firstWhere('display_name', $name);

        return $existing ?? Customer::create([
            'organization_id' => $org->id,
            'display_name' => $name,
            'phone' => '08'.random_int(10000000, 99999999),
            'total_spending' => 0,
            'visits' => 0,
        ]);
    }

    private function payment(Organization $org, Booking $booking, string $status, ?string $slipUrl = null): void
    {
        Payment::create([
            'organization_id' => $org->id,
            'booking_id' => $booking->id,
            'customer_id' => $booking->customer_id,
            'method' => 'transfer',
            'amount' => $booking->amount,
            'status' => $status,
            'slip_url' => $slipUrl,
        ]);
    }

    /** Any real uploaded image, so the slip queue is not a broken-image icon. */
    private function anySlipUrl(): ?string
    {
        $dir = storage_path('app/public/venues');

        if (! is_dir($dir)) {
            return null;
        }

        $files = array_values(array_filter(scandir($dir), fn ($f) => preg_match('/\.(jpg|png)$/i', $f)));

        return $files ? url('/storage/venues/'.$files[0]) : null;
    }
}
