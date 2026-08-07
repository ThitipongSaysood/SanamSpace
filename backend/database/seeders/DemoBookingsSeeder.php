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
 * A small, readable set of bookings — one handful per status.
 *
 * Replaces the 3,000-row load-test pile, which made every list unreadable and
 * every screenshot meaningless. Small enough to hold in your head, wide enough
 * that every status filter and the slip queue have something in them.
 *
 * Destructive: wipes existing bookings and payments first. Dev/demo only.
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

        Payment::query()->forceDelete();
        Booking::withTrashed()->forceDelete();

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
            $line = Customer::query()
                ->forOrganization($org->id)
                ->where('line_user_id', self::DEMO_LINE_USER_ID)
                ->first()
                // Not signed in on this machine yet — fall back to any LINE
                // customer rather than leaving the app with nothing at all.
                ?? $customers->first(fn ($c) => filled($c->line_user_id));

            if ($line) {
                return $line;
            }
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
