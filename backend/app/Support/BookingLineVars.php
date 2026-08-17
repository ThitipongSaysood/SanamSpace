<?php

namespace App\Support;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\Wallet;

/**
 * Builds the {{placeholder}} map a LINE template is rendered against, from a
 * booking (and, when a payment triggered the message, the payment). Every value
 * is a display-ready string — the renderer only substitutes, it does not format.
 */
class BookingLineVars
{
    private const TH_MONTH = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

    private const TH_DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

    private const METHOD_LABEL = [
        'promptpay' => 'พร้อมเพย์',
        'transfer' => 'โอนเงิน',
        'wallet' => 'เครดิต',
        'card' => 'บัตร',
    ];

    /** @return array<string,string> */
    public function forBooking(Booking $booking, ?Payment $payment = null): array
    {
        $booking->loadMissing(['court', 'branch', 'customer', 'organization']);

        $method = $payment?->method;
        $paidByCredit = $method === 'wallet';
        $paidAmount = $payment ? (float) $payment->amount : (float) $booking->amount;

        return [
            'venueName' => (string) ($booking->organization?->name ?? ''),
            'branchName' => (string) ($booking->branch?->name ?? ''),
            'customerName' => (string) ($booking->customer?->display_name ?? ''),
            'phone' => (string) ($booking->customer?->phone ?? ''),
            'courtName' => (string) ($booking->court?->name ?? ''),
            'bookingCode' => (string) ($booking->code ?? ''),
            'date' => $this->thaiDate($booking->date),
            'time' => trim((string) $booking->start.'-'.(string) $booking->end, '-'),
            'duration' => $this->duration($booking->start, $booking->end),
            // Blank when nothing came off — the receipt's discount row then drops
            // itself (the renderer removes a fully-blank infoRow).
            'discountLabel' => (string) ((float) $booking->discount_amount > 0 ? ($booking->discount_label ?? 'ส่วนลด') : ''),
            'discountValue' => (float) $booking->discount_amount > 0 ? '-'.$this->money((float) $booking->discount_amount).' บาท' : '',
            'amount' => $this->money((float) $booking->amount),
            'paymentMethod' => $method ? (self::METHOD_LABEL[$method] ?? $method) : '',
            'creditUsed' => $paidByCredit ? $this->money($paidAmount) : '',
            'creditBalance' => $this->creditBalance($booking->customer_id),
            'bookingUrl' => $this->bookingUrl($booking->organization?->slug, $booking->id),
        ];
    }

    /** Customer-app deep link to this booking, or '' when no app URL is set. */
    private function bookingUrl(?string $slug, string $bookingId): string
    {
        $base = config('services.line.customer_app_url');
        if (! $base || ! $slug) {
            return '';
        }

        return rtrim((string) $base, '/')."/v/{$slug}/booking/{$bookingId}";
    }

    private function thaiDate(?string $ymd): string
    {
        if (! $ymd || ! preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $ymd, $m)) {
            return (string) $ymd;
        }
        $y = (int) $m[1];
        $mon = (int) $m[2];
        $day = (int) $m[3];
        $dow = self::TH_DOW[(int) date('w', mktime(0, 0, 0, $mon, $day, $y))] ?? '';

        return trim("{$dow} {$day} ".(self::TH_MONTH[$mon] ?? '')." ".($y + 543));
    }

    private function duration(?string $start, ?string $end): string
    {
        if (! $start || ! $end) {
            return '';
        }
        [$sh, $sm] = array_map('intval', explode(':', $start) + [1 => 0]);
        [$eh, $em] = array_map('intval', explode(':', $end) + [1 => 0]);
        $mins = ($eh * 60 + $em) - ($sh * 60 + $sm);
        if ($mins <= 0) {
            return '';
        }
        $hours = $mins / 60;

        return (fmod($hours, 1.0) === 0.0 ? (string) (int) $hours : rtrim(rtrim(number_format($hours, 1), '0'), '.')).' ชม.';
    }

    private function creditBalance(?string $customerId): string
    {
        if (! $customerId) {
            return '';
        }
        $wallet = Wallet::query()->where('customer_id', $customerId)->first();

        return $wallet ? $this->money((float) $wallet->balance) : '';
    }

    private function money(float $n): string
    {
        return number_format($n, fmod($n, 1.0) === 0.0 ? 0 : 2);
    }
}
