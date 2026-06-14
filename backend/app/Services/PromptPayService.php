<?php

namespace App\Services;

/**
 * Builds a real, scannable PromptPay QR payload (EMVCo / Thai QR standard).
 *
 * The returned string is the exact text that goes inside the QR image — any
 * Thai banking app can scan it. The frontend renders it to a QR with a normal
 * QR library; no payment gateway or external API is involved.
 *
 * Reference: EMVCo QRCPS + Bank of Thailand "PromptPay" tag 29.
 */
class PromptPayService
{
    private const AID = 'A000000677010111';

    /**
     * @param  string  $promptpayId  phone (0xxxxxxxxx) | national/tax id (13) | e-wallet (15)
     * @param  float|null  $amount  THB amount; null/0 makes a static (reusable) QR
     */
    public function payload(string $promptpayId, ?float $amount = null): string
    {
        $id = preg_replace('/[^0-9]/', '', $promptpayId) ?? '';
        $hasAmount = $amount !== null && $amount > 0;

        // Account-info sub-tag: 03 e-wallet, 02 tax/citizen id, 01 mobile.
        $type = strlen($id) >= 15 ? '03' : (strlen($id) >= 13 ? '02' : '01');
        $target = $type === '01'
            ? substr('0000000000000'.'66'.preg_replace('/^0/', '', $id), -13)
            : $id;

        $merchant = $this->field('00', self::AID).$this->field($type, $target);

        $parts = [
            $this->field('00', '01'),                       // payload format indicator
            $this->field('01', $hasAmount ? '12' : '11'),   // 12 = dynamic (one-time), 11 = static
            $this->field('29', $merchant),                  // PromptPay merchant account info
            $this->field('53', '764'),                      // currency THB
        ];

        if ($hasAmount) {
            $parts[] = $this->field('54', number_format($amount, 2, '.', ''));
        }

        $parts[] = $this->field('58', 'TH');                // country code

        $payload = implode('', $parts).'6304';              // CRC tag id + length, value computed next
        return $payload.$this->crc16($payload);
    }

    /** EMVCo TLV field: id(2) + length(2, zero-padded) + value. */
    private function field(string $id, string $value): string
    {
        return $id.str_pad((string) strlen($value), 2, '0', STR_PAD_LEFT).$value;
    }

    /** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), uppercase 4-hex. */
    private function crc16(string $data): string
    {
        $crc = 0xFFFF;
        for ($i = 0, $n = strlen($data); $i < $n; $i++) {
            $crc ^= ord($data[$i]) << 8;
            for ($j = 0; $j < 8; $j++) {
                $crc = ($crc & 0x8000) ? (($crc << 1) ^ 0x1021) : ($crc << 1);
                $crc &= 0xFFFF;
            }
        }

        return strtoupper(str_pad(dechex($crc), 4, '0', STR_PAD_LEFT));
    }
}
