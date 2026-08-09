<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\PlatformSetting;
use App\Models\PlatformTransaction;
use App\Models\Subscription;
use App\Support\PlanFeatures;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Central money logic for keeping a venue's subscription alive, shared by the
 * Owner and Admin portals so the "what does paying actually buy" rule is
 * defined ONCE.
 *
 * Lifecycle: an Invoice is raised (by the venue renewing itself, or by the
 * platform billing them) → the venue transfers and uploads a slip
 * (`pending_review`) → a Super Admin approves, which is the only thing that
 * moves `subscriptions.ends_at`. Approve/reject are guarded to outstanding
 * invoices, so one transfer can never be counted twice.
 */
class SubscriptionRenewalService
{
    /**
     * Raise an invoice for `$months` of the org's current plan.
     *
     * @param  string  $source  'owner' (the venue renewing itself) or 'admin'
     *
     * @throws ValidationException when the org has no plan to renew.
     */
    public function raiseInvoice(Organization $org, int $months, string $source = 'owner', ?Plan $plan = null): Invoice
    {
        $plan ??= $this->currentSubscription($org)?->plan;

        if (! $plan) {
            throw ValidationException::withMessages([
                'plan' => 'สนามนี้ยังไม่มีแพ็กเกจ กรุณาติดต่อผู้ดูแลระบบ',
            ]);
        }

        // One outstanding renewal at a time — otherwise a venue can stack
        // invoices and an admin has no way to tell which transfer paid which.
        if ($existing = $this->outstandingInvoice($org)) {
            return $existing;
        }

        $now = CarbonImmutable::now();
        $total = $this->priceFor($plan, $months);

        return Invoice::create(array_merge([
            'number' => $this->nextNumber('INV'),
            'organization_id' => $org->id,
            'organization_name' => $org->name,
            'plan_id' => $plan->id,
            'amount' => $total,
            'period_months' => $months,
            'source' => $source,
            'status' => 'unpaid',
            'issue_date' => $now->format('Y-m-d'),
            'due_date' => $now->addDays(7)->format('Y-m-d'),
        ], $this->taxSplit($total)));
    }

    /**
     * Break a VAT-inclusive total into net + tax, at today's configured rate.
     *
     * Plan prices are what the venue actually pays, so the tax is backed out of
     * the total rather than added on top. The rate is stored alongside the
     * split: changing it later must not rewrite documents already issued.
     *
     * @return array{subtotal: float, vat_amount: float, vat_rate: float}
     */
    private function taxSplit(float $total): array
    {
        $settings = PlatformSetting::query()->first();
        $rate = $settings?->vat_enabled ? (float) $settings->vat_rate : 0.0;

        if ($rate <= 0) {
            return ['subtotal' => $total, 'vat_amount' => 0.0, 'vat_rate' => 0.0];
        }

        $subtotal = round($total / (1 + $rate / 100), 2);

        return [
            'subtotal' => $subtotal,
            // Taken as the remainder so the parts always add back to the total.
            'vat_amount' => round($total - $subtotal, 2),
            'vat_rate' => $rate,
        ];
    }

    /**
     * Approve a paid invoice: extend the subscription and record the money.
     *
     * The new period is added to whichever is later — today or the current
     * end date — so renewing early never costs the venue the days it already
     * paid for, and renewing late does not back-date the months away.
     *
     * @throws ValidationException when the invoice is not outstanding.
     */
    public function approve(Invoice $invoice, ?string $method = 'transfer'): Invoice
    {
        if (! $invoice->isOutstanding()) {
            throw ValidationException::withMessages([
                'invoice' => 'ใบแจ้งหนี้นี้ถูกดำเนินการไปแล้ว',
            ]);
        }

        return DB::transaction(function () use ($invoice, $method) {
            $now = CarbonImmutable::now();

            if ($invoice->organization_id) {
                $this->extendSubscription($invoice, $now);
            }

            PlatformTransaction::create([
                'organization_name' => $invoice->organization_name,
                'type' => 'subscription',
                'amount' => $invoice->amount,
                'method' => $method ?: 'transfer',
                'status' => 'success',
            ]);

            $invoice->update([
                'status' => 'paid',
                'paid_at' => $now,
                'paid_date' => $now->format('Y-m-d'),
                'reject_reason' => null,
                // The receipt is issued here, once. Keeping any existing number
                // means re-running this can never mint a second one.
                'receipt_number' => $invoice->receipt_number ?: $this->nextNumber('RCP'),
                'receipt_date' => $invoice->receipt_date ?: $now->format('Y-m-d'),
            ]);

            return $invoice->fresh();
        });
    }

    /**
     * Reject a submitted slip — the invoice goes back to unpaid so the venue
     * can transfer again; the subscription is untouched.
     *
     * @throws ValidationException when the invoice is not outstanding.
     */
    public function reject(Invoice $invoice, ?string $reason = null): Invoice
    {
        if (! $invoice->isOutstanding()) {
            throw ValidationException::withMessages([
                'invoice' => 'ใบแจ้งหนี้นี้ถูกดำเนินการไปแล้ว',
            ]);
        }

        $invoice->update([
            'status' => 'rejected',
            'reject_reason' => $reason,
        ]);

        return $invoice->fresh();
    }

    /**
     * Move a venue onto a different package, in either direction, at once.
     *
     * The one implementation of the rule. There were two — one addressed by
     * organisation and one by subscription — and they disagreed: the older one
     * created a subscription with NO end date when the venue had none, and
     * `isExpired()` reads a null `ends_at` as "never expires". Changing a
     * plan could hand a venue the platform free, forever, with no invoice
     * anyone would ever see.
     *
     * A venue that had nothing gets the same 30 days a newly created one does,
     * so the next renewal is a normal renewal rather than a rescue.
     */
    public function changePlan(Organization $org, Plan $plan): Subscription
    {
        $sub = $this->currentSubscription($org);

        if ($sub) {
            $sub->update(['plan_id' => $plan->id]);
        } else {
            $sub = Subscription::create([
                'organization_id' => $org->id,
                'plan_id' => $plan->id,
                'status' => 'active',
                'started_at' => now(),
                'ends_at' => now()->addDays(30),
            ]);
        }

        // The entitlement resolver memoises per request; without this the
        // venue's own next call in the same process still sees the old plan.
        PlanFeatures::flush();

        return $sub->fresh(['plan']);
    }

    /**
     * Put a venue on a free trial of a plan for `$days`.
     *
     * The subscription stays `active` and the trial lives on the organisation.
     * A separate `trialing` status would read better in the table and break
     * half the platform: `activeSubscription()` filters on `active`, so every
     * screen that reads a venue's plan through it would show no plan at all.
     * Every lockout path already goes through `ends_at`, so a trial that runs
     * out locks the portal exactly like a lapsed subscription — nothing extra
     * to remember, and nothing extra to forget.
     */
    public function startTrial(Organization $org, Plan $plan, int $days): Subscription
    {
        $now = CarbonImmutable::now();
        $endsAt = $now->addDays($days);
        $sub = $this->currentSubscription($org);

        if ($sub) {
            $sub->update(['plan_id' => $plan->id, 'status' => 'active', 'ends_at' => $endsAt]);
        } else {
            $sub = Subscription::create([
                'organization_id' => $org->id,
                'plan_id' => $plan->id,
                'status' => 'active',
                'started_at' => $now,
                'ends_at' => $endsAt,
            ]);
        }

        $org->update(['trial_start_at' => $now, 'trial_end_at' => $endsAt]);
        PlanFeatures::flush();

        return $sub->fresh(['plan']);
    }

    /**
     * Set the end date by hand — the escape hatch, not the renewal path.
     *
     * For fixing a date entered wrong, or honouring something agreed off the
     * system. It moves no money and issues no document, which is exactly why
     * the caller has to give a reason: this is the one action that can hand a
     * venue months of service with nothing in the ledger to show for it.
     */
    public function setEndsAt(Subscription $sub, CarbonImmutable $endsAt): Subscription
    {
        // A plan suspended by mistake has a past date AND a cancelled status;
        // giving it a future date without clearing the status would leave the
        // admin screens saying "ยกเลิก" about a venue that is working.
        $sub->update(['ends_at' => $endsAt, 'status' => 'active']);
        PlanFeatures::flush();

        return $sub->fresh(['plan']);
    }

    /** The org's subscription — the active one if there is one, else the newest. */
    public function currentSubscription(Organization $org): ?Subscription
    {
        return Subscription::query()
            ->forOrganization($org->id)
            ->with('plan')
            ->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->orderByDesc('created_at')
            ->first();
    }

    /** The invoice a venue still has to pay, if any. */
    public function outstandingInvoice(Organization $org): ?Invoice
    {
        return Invoice::query()
            ->forOrganization($org->id)
            ->whereIn('status', ['unpaid', 'overdue', 'pending_review'])
            ->orderByDesc('created_at')
            ->first();
    }

    /** Whole days until the subscription lapses; negative once it has. */
    public function daysRemaining(?Subscription $sub): ?int
    {
        if (! $sub?->ends_at) {
            return null;
        }

        return (int) now()->startOfDay()->diffInDays($sub->ends_at->copy()->startOfDay(), false);
    }

    /** A subscription with no end date never expires (e.g. a lifetime deal). */
    public function isExpired(?Subscription $sub): bool
    {
        if (! $sub) {
            return true;
        }

        return $sub->ends_at !== null && $sub->ends_at->isPast();
    }

    private function extendSubscription(Invoice $invoice, CarbonImmutable $now): void
    {
        $org = Organization::find($invoice->organization_id);
        $sub = $org ? $this->currentSubscription($org) : null;
        $months = max(1, (int) $invoice->period_months);

        // Money changed hands, so the trial is over whatever date it was going
        // to run to. Ended rather than erased: when the venue started trying
        // the product is worth keeping.
        if ($org?->trial_end_at?->isFuture()) {
            $org->update(['trial_end_at' => $now]);
        }

        if (! $sub) {
            Subscription::create([
                'organization_id' => $invoice->organization_id,
                'plan_id' => $invoice->plan_id,
                'status' => 'active',
                'started_at' => $now,
                'ends_at' => $now->addMonths($months),
            ]);

            return;
        }

        // Renewing early keeps the unused days; renewing late starts from today.
        $from = $sub->ends_at && $sub->ends_at->isFuture()
            ? CarbonImmutable::parse($sub->ends_at)
            : $now;

        $sub->update([
            'plan_id' => $invoice->plan_id ?: $sub->plan_id,
            'status' => 'active',
            'started_at' => $sub->started_at ?: $now,
            'ends_at' => $from->addMonths($months),
        ]);
    }

    /** Yearly plans are priced per interval; months are charged pro-rata. */
    private function priceFor(Plan $plan, int $months): float
    {
        $perMonth = $plan->interval === 'year'
            ? (float) $plan->price / 12
            : (float) $plan->price;

        return round($perMonth * $months, 2);
    }

    /**
     * Next document number in the {prefix}-{year}-{seq} series.
     *
     * Invoices and receipts run separate sequences — a venue may be billed
     * without ever paying, so the two must not share a counter.
     */
    private function nextNumber(string $prefix): string
    {
        $year = now()->year;
        $column = $prefix === 'RCP' ? 'receipt_number' : 'number';
        $seq = Invoice::query()->where($column, 'like', "{$prefix}-{$year}-%")->count() + 1;

        do {
            $number = sprintf('%s-%d-%04d', $prefix, $year, $seq);
            $seq++;
        } while (Invoice::query()->where($column, $number)->exists());

        return $number;
    }
}
