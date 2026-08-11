<?php

namespace App\Support;

/**
 * What each plan includes — written once.
 *
 * The seeder had its own copy of the matrix and the pricing page had another.
 * Two lists of what a customer is paying for will drift, and the one that
 * drifts is the one that hands out something nobody was charged for.
 *
 * **Anything absent from here is core**, available on every plan: bookings,
 * check-in, slip review, customers, refunds, reports, courts, staff. A venue
 * that cannot take a booking has no reason to pay at all, so those are not
 * entries — and a new page cannot become unavailable to everyone because
 * somebody forgot to add a row.
 *
 * Three tiers. Enterprise was removed: it was priced at ฿0, had no customers,
 * and its only distinct feature was a white-label domain that does not exist —
 * a fourth column on the pricing page that sold nothing.
 *
 * The platform operator can change any of this from the admin screen; this is
 * only the starting point a fresh install is seeded with.
 */
class PlanCatalogue
{
    /** @var array<string, array{0: string, 1: list<string>}> code => [name, plans] */
    public const FEATURES = [
        // --- Business: selling things, and keeping regulars ---
        'pos' => ['ขายหน้าร้าน (POS) + สินค้า', ['business', 'pro']],
        'rental' => ['อุปกรณ์ให้เช่า', ['business', 'pro']],
        'wallet' => ['เครดิตลูกค้า', ['business', 'pro']],
        'package' => ['แพ็กเกจชั่วโมง', ['business', 'pro']],
        'membership' => ['สมาชิก + คะแนนสะสม + ของรางวัล', ['business', 'pro']],
        'coupon' => ['คูปองส่วนลด', ['business', 'pro']],
        'banner' => ['แบนเนอร์/ป๊อปอัปต้อนรับ', ['business', 'pro']],
        // Costs real money to run: the slip-verify provider charges per check.
        'slip_auto_verify' => ['ตรวจสลิปอัตโนมัติ', ['business', 'pro']],

        // --- Pro: marketing to the customer base ---
        'crm' => ['CRM (เซกเมนต์ · RFM)', ['pro']],
        // Costs real money to run: LINE charges per message.
        'broadcast' => ['ยิงโปร LINE', ['pro']],
        'advanced_reports' => ['รายงานขั้นสูง + ส่งออก', ['pro']],
    ];

    /** @return list<string> */
    public static function codes(): array
    {
        return array_keys(self::FEATURES);
    }

    /** @return list<string> the feature codes a plan starts with */
    public static function forPlan(string $planCode): array
    {
        return array_keys(array_filter(
            self::FEATURES,
            fn (array $def) => in_array($planCode, $def[1], true),
        ));
    }
}
