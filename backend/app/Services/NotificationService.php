<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Notification;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\WalletTransaction;

/**
 * Creates the in-app notifications a customer sees in their bell.
 *
 * Before this, `Notification` rows were only ever written by the seeder — a
 * slip approved, a slip rejected, a refund, a top-up all told the customer
 * nothing. This is the single place those events turn into a notification, so
 * the wording and shape stay consistent across every portal that triggers one
 * (mirrors how money always goes through one service).
 *
 * `time_ago` is a stored, pre-formatted Thai label (the schema keeps no
 * separate timestamp for it); a freshly created notification is "เมื่อสักครู่".
 */
class NotificationService
{
    /** A booking's payment slip was approved → the booking is confirmed. */
    public function paymentApproved(Payment $payment): void
    {
        $booking = $payment->booking;

        $this->create(
            $payment->organization_id,
            $payment->customer_id,
            'ชำระเงินสำเร็จ',
            $booking?->code
                ? "การจอง {$booking->code} ได้รับการยืนยันแล้ว"
                : 'การชำระเงินของคุณได้รับการยืนยันแล้ว',
        );
    }

    /** A booking's payment slip was rejected → the customer must re-submit. */
    public function paymentRejected(Payment $payment): void
    {
        $booking = $payment->booking;

        $this->create(
            $payment->organization_id,
            $payment->customer_id,
            'สลิปไม่ผ่านการตรวจสอบ',
            $booking?->code
                ? "สลิปการจอง {$booking->code} ไม่ผ่าน กรุณาอัปโหลดใหม่อีกครั้ง"
                : 'สลิปการชำระเงินไม่ผ่าน กรุณาอัปโหลดใหม่อีกครั้ง',
        );
    }

    /** A refund was approved (wallet credited or recorded manually). */
    public function refundApproved(Refund $refund): void
    {
        $amount = number_format((float) $refund->amount, 2);

        $this->create(
            $refund->organization_id,
            $refund->customer_id,
            'คืนเงินสำเร็จ',
            "คำขอคืนเงิน ฿{$amount} ได้รับการอนุมัติแล้ว",
        );
    }

    /** A refund request was rejected. */
    public function refundRejected(Refund $refund): void
    {
        $amount = number_format((float) $refund->amount, 2);

        $this->create(
            $refund->organization_id,
            $refund->customer_id,
            'คำขอคืนเงินไม่ได้รับอนุมัติ',
            "คำขอคืนเงิน ฿{$amount} ถูกปฏิเสธ",
        );
    }

    /** A wallet top-up slip was approved → balance credited. */
    public function topupApproved(WalletTransaction $txn): void
    {
        $wallet = $txn->wallet;
        $amount = number_format((float) $txn->amount, 2);

        if (! $wallet) {
            return;
        }

        $this->create(
            $wallet->organization_id,
            $wallet->customer_id,
            'เติมเงินสำเร็จ',
            "เติมเงิน ฿{$amount} เข้ากระเป๋าเงินเรียบร้อยแล้ว",
        );
    }

    /** A wallet top-up slip was rejected. */
    public function topupRejected(WalletTransaction $txn): void
    {
        $wallet = $txn->wallet;
        $amount = number_format((float) $txn->amount, 2);

        if (! $wallet) {
            return;
        }

        $this->create(
            $wallet->organization_id,
            $wallet->customer_id,
            'การเติมเงินไม่สำเร็จ',
            "สลิปเติมเงิน ฿{$amount} ไม่ผ่านการตรวจสอบ",
        );
    }

    /** A booking was cancelled by the venue (not the customer's own action). */
    public function bookingCancelled(Booking $booking): void
    {
        $this->create(
            $booking->organization_id,
            $booking->customer_id,
            'การจองถูกยกเลิก',
            $booking->code
                ? "การจอง {$booking->code} ถูกยกเลิกแล้ว"
                : 'การจองของคุณถูกยกเลิกแล้ว',
        );
    }

    /** An unpaid booking passed its hold window and was released. */
    public function bookingExpired(Booking $booking): void
    {
        $this->create(
            $booking->organization_id,
            $booking->customer_id,
            'การจองหมดเวลาชำระเงิน',
            $booking->code
                ? "การจอง {$booking->code} ถูกยกเลิกเนื่องจากไม่ได้ชำระเงินในเวลาที่กำหนด"
                : 'การจองของคุณถูกยกเลิกเนื่องจากไม่ได้ชำระเงินในเวลาที่กำหนด',
        );
    }

    /**
     * A broadcast shown inside the customer app (the "แสดงในแอป" delivery
     * target) — a promo card in the customer's notification bell.
     */
    public function promo(string $organizationId, string $customerId, string $title, string $body, ?string $imageUrl = null): void
    {
        $this->create($organizationId, $customerId, $title, $body, 'promo', $imageUrl);
    }

    private function create(string $organizationId, ?string $customerId, string $title, string $body, string $kind = 'booking', ?string $imageUrl = null): void
    {
        // A broadcast (null customer) has no single recipient to notify here.
        if (! $customerId) {
            return;
        }

        Notification::create([
            'organization_id' => $organizationId,
            'customer_id' => $customerId,
            'kind' => $kind,
            'title' => $title,
            'body' => $body,
            'image_url' => $imageUrl,
            'time_ago' => 'เมื่อสักครู่',
            'sort_order' => 0,
        ]);
    }
}
