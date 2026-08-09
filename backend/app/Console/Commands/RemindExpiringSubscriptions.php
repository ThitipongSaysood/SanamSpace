<?php

namespace App\Console\Commands;

use App\Models\Invoice;
use App\Models\Organization;
use App\Services\SubscriptionRenewalService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

/**
 * Tell a venue its subscription is about to run out, before it does.
 *
 * Until this existed a venue found out by being locked out mid-shift: the
 * owner portal answers 402 the moment `ends_at` passes, and nothing anywhere
 * had said a word beforehand. The number was on their dashboard, which is only
 * useful to someone already looking at it.
 *
 * Warnings go out at 7, 3 and 1 days. Exact-day matching is what keeps this
 * from becoming noise — running daily, each venue hears three times, not every
 * morning for a week.
 *
 * It also ages unpaid invoices past their due date into `overdue`. That status
 * was in the schema and in every query that reads outstanding invoices, and
 * nothing ever set it, so a bill three weeks late still read "unpaid" and
 * looked identical to one raised this morning.
 */
class RemindExpiringSubscriptions extends Command
{
    protected $signature = 'subscriptions:remind-expiring';

    protected $description = 'Warn venues whose subscription is about to lapse, and age overdue invoices';

    /** Days before expiry that are worth an email. */
    private const WARN_AT = [7, 3, 1];

    public function handle(SubscriptionRenewalService $renewals): int
    {
        $overdue = Invoice::query()
            ->whereIn('status', ['unpaid'])
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', now()->toDateString())
            ->update(['status' => 'overdue']);

        $warned = 0;

        $organizations = Organization::query()
            ->with(['settings'])
            ->where('status', 'active')
            ->get();

        foreach ($organizations as $org) {
            $days = $renewals->daysRemaining($renewals->currentSubscription($org));

            if ($days === null || ! in_array($days, self::WARN_AT, true)) {
                continue;
            }

            if ($this->notify($org, $days)) {
                $warned++;
            }
        }

        $this->info("Subscriptions: warned {$warned} venue(s), marked {$overdue} invoice(s) overdue.");

        return self::SUCCESS;
    }

    /** @return bool whether the venue could actually be reached */
    private function notify(Organization $org, int $days): bool
    {
        $email = $org->settings?->email;

        if (! $email) {
            // Said out loud rather than skipped quietly: a venue with no
            // contact address is one that gets locked out with no warning.
            $this->line("  ! {$org->name}: เหลือ {$days} วัน แต่ไม่มีอีเมลติดต่อ");

            return false;
        }

        $body = "เรียน {$org->name}\n\n"
            ."แพ็กเกจ SanamSpace ของท่านจะหมดอายุในอีก {$days} วัน\n\n"
            ."เมื่อหมดอายุ ระบบจัดการสนามจะถูกล็อกจนกว่าจะต่ออายุ "
            ."(ลูกค้าของท่านยังจองสนามได้ตามปกติ)\n\n"
            ."ต่ออายุได้ที่หน้า “ค่าบริการระบบ” ในระบบจัดการสนามของท่าน\n\n"
            ."ขอบคุณที่ใช้บริการ SanamSpace";

        try {
            Mail::raw($body, function ($m) use ($email, $days) {
                $m->to($email)->subject("แพ็กเกจจะหมดอายุในอีก {$days} วัน - SanamSpace");
            });
        } catch (\Throwable $e) {
            // One unreachable venue must not stop the rest of the run.
            $this->line("  ! {$org->name}: ส่งอีเมลไม่สำเร็จ ({$e->getMessage()})");

            return false;
        }

        return true;
    }
}
