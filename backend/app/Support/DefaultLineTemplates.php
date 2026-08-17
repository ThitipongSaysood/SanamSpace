<?php

namespace App\Support;

/**
 * The LINE Flex templates a venue starts with, before it touches the builder.
 * Kept in code (not seeded) so every venue — including ones created before this
 * feature — has a working receipt the moment it sets a LINE token, and so the
 * shipped defaults can improve without a data migration.
 *
 * The block vocabulary here is exactly what LineFlexRenderer understands.
 */
class DefaultLineTemplates
{
    /** Events that message the customer out of the box; payment_received is off
     *  by default so it never doubles up with booking_confirmed. */
    private const ENABLED = [
        'booking_confirmed' => true,
        'payment_received' => false,
        'booking_cancelled' => true,
    ];

    public function enabledByDefault(string $event): bool
    {
        return self::ENABLED[$event] ?? false;
    }

    /**
     * Stand-in values for a preview / test send, so the owner sees a real-
     * looking card without a real booking. `venueName` is filled by the caller.
     *
     * @return array<string,string>
     */
    public function sampleVars(): array
    {
        return [
            'venueName' => 'สนามของคุณ',
            'branchName' => 'สาขาหลัก',
            'customerName' => 'คุณลูกค้า ตัวอย่าง',
            'phone' => '0812345678',
            'courtName' => 'Court 1',
            'bookingCode' => 'BKF-DEMO-01',
            'date' => 'ส. 15 ส.ค. 2569',
            'time' => '09:00-10:00',
            'duration' => '1 ชม.',
            'amount' => '450',
            'paymentMethod' => 'เครดิต',
            'creditUsed' => '450',
            'creditBalance' => '3,150',
            'bookingUrl' => '',
        ];
    }

    /** Plain-text fallback LINE shows in the chat list / on old devices. */
    public function altText(string $event): string
    {
        return match ($event) {
            'booking_confirmed' => 'ยืนยันการจอง {{bookingCode}} เรียบร้อยแล้ว',
            'payment_received' => 'ได้รับชำระเงินการจอง {{bookingCode}} แล้ว',
            'booking_cancelled' => 'การจอง {{bookingCode}} ถูกยกเลิกแล้ว',
            default => 'อัปเดตการจอง {{bookingCode}}',
        };
    }

    /** @return array<int,array<string,mixed>> */
    public function blocks(string $event): array
    {
        return match ($event) {
            'booking_cancelled' => $this->cancelled(),
            'payment_received' => $this->receipt('ได้รับชำระเงินแล้ว', '#059669'),
            default => $this->receipt('COURT BOOKING RECEIPT', '#1D4ED8'),
        };
    }

    /** @return array<int,array<string,mixed>> */
    private function receipt(string $kicker, string $accent): array
    {
        return [
            ['type' => 'text', 'text' => $kicker, 'size' => 'sm', 'color' => $accent, 'weight' => 'bold'],
            ['type' => 'title', 'text' => '{{venueName}}', 'size' => 'xl'],
            ['type' => 'divider'],
            ['type' => 'infoRow', 'label' => 'ลูกค้า', 'value' => '{{customerName}}'],
            ['type' => 'infoRow', 'label' => 'เบอร์', 'value' => '{{phone}}'],
            ['type' => 'infoRow', 'label' => 'คอร์ท', 'value' => '{{courtName}}'],
            ['type' => 'infoRow', 'label' => 'เวลา', 'value' => '{{time}} ({{duration}})'],
            ['type' => 'infoRow', 'label' => 'วันที่', 'value' => '{{date}}'],
            ['type' => 'infoRow', 'label' => 'สาขา', 'value' => '{{branchName}}'],
            ['type' => 'divider'],
            ['type' => 'infoRow', 'label' => 'วิธีชำระ', 'value' => '{{paymentMethod}}'],
            // Only shows when a discount applied — the renderer drops a blank row.
            ['type' => 'infoRow', 'label' => '{{discountLabel}}', 'value' => '{{discountValue}}', 'color' => '#D97706'],
            ['type' => 'infoRow', 'label' => 'ยอดรวม', 'value' => '{{amount}} บาท', 'color' => $accent],
            ['type' => 'divider'],
            ['type' => 'text', 'text' => 'ยืนยันการจองเรียบร้อยแล้ว ขอบคุณที่ใช้บริการ 🎾', 'size' => 'sm', 'align' => 'center', 'color' => '#8A8A8A'],
            // Wired but inert until the booking deep link var exists (Phase 2) —
            // an unresolved url makes the renderer drop the button, not the card.
            ['type' => 'buttonRow', 'buttons' => [
                ['type' => 'button', 'label' => 'ข้อมูลการจอง', 'url' => '{{bookingUrl}}', 'style' => 'primary', 'color' => $accent],
            ]],
        ];
    }

    /** @return array<int,array<string,mixed>> */
    private function cancelled(): array
    {
        return [
            ['type' => 'text', 'text' => 'แจ้งยกเลิกการจอง', 'size' => 'sm', 'color' => '#DC2626', 'weight' => 'bold'],
            ['type' => 'title', 'text' => '{{venueName}}', 'size' => 'xl'],
            ['type' => 'divider'],
            ['type' => 'infoRow', 'label' => 'รหัสจอง', 'value' => '{{bookingCode}}'],
            ['type' => 'infoRow', 'label' => 'คอร์ท', 'value' => '{{courtName}}'],
            ['type' => 'infoRow', 'label' => 'เวลา', 'value' => '{{time}}'],
            ['type' => 'infoRow', 'label' => 'วันที่', 'value' => '{{date}}'],
            ['type' => 'divider'],
            ['type' => 'text', 'text' => 'การจองนี้ถูกยกเลิกแล้ว หากมีข้อสงสัยติดต่อสนามได้เลยค่ะ', 'size' => 'sm', 'align' => 'center', 'color' => '#8A8A8A'],
        ];
    }
}
