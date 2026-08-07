<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Organization;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Checking a customer in at the counter.
 *
 * Every refusal here has a reason a staff member can act on out loud — "มาเร็ว
 * ไป 2 ชั่วโมง", "รายการนี้ยกเลิกไปแล้ว" — rather than a generic failure. The
 * person is standing in front of them; "invalid" is not an answer.
 */
class CheckinService
{
    /** Doors open this long before the slot starts. */
    private const EARLY_MINUTES = 60;

    /** …and the code stops working this long after it ends. */
    private const LATE_MINUTES = 120;

    /** A token to put in the QR. Not the booking code — that is guessable. */
    public static function newToken(): string
    {
        return Str::lower(Str::random(32));
    }

    /**
     * Resolve a scanned token within one venue.
     *
     * Scoped to the organization: a code from another venue is simply not
     * found here, which is also the honest thing to tell the staff member.
     */
    public function find(Organization $org, string $token): ?Booking
    {
        return Booking::query()
            ->with(['court', 'customer'])
            ->where('organization_id', $org->id)
            ->where(function ($q) use ($token) {
                $q->where('checkin_token', Str::lower(trim($token)))
                    // Staff can also type the booking code off the customer's
                    // screen when a camera is not an option.
                    ->orWhere('code', Str::upper(trim($token)));
            })
            ->first();
    }

    /**
     * Attempt the check-in.
     *
     * @return array{ok: bool, code: string, message: string, booking: Booking}
     */
    public function attempt(Booking $booking, ?Carbon $now = null): array
    {
        $now ??= now();

        if ($booking->status === 'cancelled') {
            return $this->result(false, 'cancelled', 'การจองนี้ถูกยกเลิกแล้ว', $booking);
        }

        if ($booking->status === 'pending_payment') {
            return $this->result(false, 'unpaid', 'ยังไม่ได้ชำระเงิน — รับชำระที่เคาน์เตอร์ก่อน', $booking);
        }

        // Booking times are the venue's wall clock ("18:00 means 18:00 at the
        // counter"), but the app runs on UTC. Comparing them without this is
        // seven hours out in Thailand — every afternoon arrival was refused as
        // "too early".
        $tz = $this->timezoneFor($booking);

        // Idempotent: scanning twice is a normal thing to do, not an error. The
        // staff member gets told when it happened instead of a red screen.
        if ($booking->checked_in_at) {
            return $this->result(
                true,
                'already',
                'เช็คอินแล้วเมื่อ '.$booking->checked_in_at->timezone($tz)->format('H:i'),
                $booking,
            );
        }

        $start = Carbon::parse("{$booking->date} {$booking->start}", $tz);
        $end = Carbon::parse("{$booking->date} {$booking->end}", $tz);

        if ($now->lt($start->copy()->subMinutes(self::EARLY_MINUTES))) {
            return $this->result(
                false,
                'too_early',
                'ยังไม่ถึงเวลา — เริ่ม '.$start->format('H:i').' น. วันที่ '.$start->format('d/m/Y'),
                $booking,
            );
        }

        if ($now->gt($end->copy()->addMinutes(self::LATE_MINUTES))) {
            return $this->result(
                false,
                'expired',
                'เลยเวลาแล้ว — รอบนี้จบไปเมื่อ '.$end->format('H:i').' น. วันที่ '.$end->format('d/m/Y'),
                $booking,
            );
        }

        $booking->update([
            'checked_in_at' => $now,
            // Kept from the previous behaviour so reports that count completed
            // bookings do not change meaning underneath them.
            'status' => 'completed',
        ]);

        return $this->result(true, 'checked_in', 'เช็คอินสำเร็จ', $booking->fresh(['court', 'customer']));
    }

    /** The clock the venue actually runs on; the app's own is UTC. */
    private function timezoneFor(Booking $booking): string
    {
        $booking->loadMissing('organization.settings');

        return $booking->organization?->settings?->timezone ?: 'Asia/Bangkok';
    }

    private function result(bool $ok, string $code, string $message, Booking $booking): array
    {
        return ['ok' => $ok, 'code' => $code, 'message' => $message, 'booking' => $booking];
    }
}
