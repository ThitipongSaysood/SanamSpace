<?php

namespace App\Services;

use App\Models\OrganizationSetting;
use App\Models\Payment;
use App\Models\PaymentSlip;
use App\Services\Slip\SlipVerifier;
use App\Support\PlanFeatures;
use App\Support\SlipVerification;
use Illuminate\Support\Facades\Log;

/**
 * Phase 0 slip screening: catch a re-used slip without any external API.
 *
 * A real bank transfer produces one unique transaction reference; a slip image
 * re-submitted for a second booking is either the exact same file (same sha256)
 * or a re-saved copy of the same transaction (same trans_ref). Either way it was
 * already used, so we flag it for the owner rather than letting a single ฿250
 * transfer confirm five courts.
 *
 * The provider-backed verification (SlipOK/EasySlip) is a Phase 1 driver that
 * will slot in here; this class deliberately owns only the dedupe for now.
 */
class SlipVerificationService
{
    /** Provider calls per venue per month — a backstop on the per-check cost. */
    private const MONTHLY_AUTO_LIMIT = 1000;

    public function __construct(
        private SlipVerifier $verifier,
        private DepositService $deposits,
        private NotificationService $notifications,
    ) {}

    /**
     * Screen a freshly-uploaded slip, then auto-approve it when the venue is in
     * `auto` mode and the slip passes verification. A duplicate, a manual-mode
     * venue, or any uncertainty leaves the slip in the manual queue — never a
     * silent wrong approval. Called right after the payment is moved to
     * pending_review.
     */
    public function process(PaymentSlip $slip): void
    {
        // A re-used slip is flagged and never auto-approved.
        if ($this->screen($slip)) {
            return;
        }

        $payment = $slip->payment;
        // Idempotency: only an undecided payment can be auto-approved (guards a
        // double upload / re-run from approving twice).
        if (! $payment || $payment->status !== 'pending_review') {
            return;
        }

        $settings = OrganizationSetting::query()
            ->where('organization_id', $slip->organization_id)
            ->first();

        if (($settings?->slip_verify_mode ?? 'manual') !== 'auto') {
            return; // venue reviews slips by hand
        }

        // Auto-verify is a paid feature and each check costs money — gate on the
        // plan, then cap the calls per month so a bad month can't run up a bill.
        if (! PlanFeatures::allows($slip->organization_id, 'slip_auto_verify')) {
            return;
        }
        if ($this->monthlyCallsUsed($slip->organization_id) >= self::MONTHLY_AUTO_LIMIT) {
            return; // over the cap → fall to manual for the rest of the month
        }

        try {
            $v = $this->verifier->verify($slip);

            // Keep whatever the provider could read, even if it doesn't clear the
            // bar — it pre-fills the manual review.
            $slip->update([
                'verify_source' => (string) config('services.slip.driver', 'null'),
                'verified_amount' => $v->amount,
                'sender_name' => $v->senderName,
                'receiver_ref' => $v->receiverRef,
                'trans_ref' => $slip->trans_ref ?: $v->transRef,
            ]);

            if ($this->passes($v, $payment, $settings)) {
                // Same path as a manual approval, so points/receipt/confirm all
                // happen exactly once.
                $payment->update(['status' => 'approved']);
                if ($payment->booking) {
                    $this->deposits->applyPayment($payment->booking, (float) $payment->amount);
                }
                $this->notifications->paymentApproved($payment);
                $slip->update(['verify_status' => 'verified']);
            }
        } catch (\Throwable $e) {
            // Provider down / timeout → fall back to manual, never block the flow.
            Log::warning('slip auto-verify failed', ['slip' => $slip->id, 'error' => $e->getMessage()]);
        }
    }

    /** How many billable provider checks this venue has run this month. Non-
     *  provider sources (dedupe-only) don't cost anything, so they don't count. */
    private function monthlyCallsUsed(?string $orgId): int
    {
        return PaymentSlip::query()
            ->where('organization_id', $orgId)
            ->whereNotIn('verify_source', ['manual', 'hash', 'qr', 'null'])
            ->where('created_at', '>=', now()->startOfMonth())
            ->count();
    }

    /** All must hold to auto-approve: real slip · covers the amount · paid into
     *  the venue's own account. (Ref-uniqueness is already handled by screen().) */
    private function passes(SlipVerification $v, Payment $payment, ?OrganizationSetting $settings): bool
    {
        if (! $v->ok) {
            return false;
        }
        if ($v->amount === null || $v->amount + 0.001 < (float) $payment->amount) {
            return false;
        }

        return $this->receiverMatches($v->receiverRef, $settings);
    }

    /** The slip's receiver must be the venue's PromptPay/bank account. Slips mask
     *  the account, so match on the trailing digits; can't confirm → manual. */
    private function receiverMatches(?string $receiverRef, ?OrganizationSetting $settings): bool
    {
        $ours = preg_replace('/\D+/', '', ($settings?->promptpay_id ?? '').($settings?->bank_account_number ?? ''));
        $theirs = preg_replace('/\D+/', '', (string) $receiverRef);
        if ($ours === '' || $theirs === '' || strlen($theirs) < 4) {
            return false;
        }

        return str_contains($ours, substr($theirs, -4)) || str_contains($theirs, substr($ours, -4));
    }

    /**
     * Flag the slip as `duplicate` when the same file or transaction reference
     * has already been submitted on another payment in this venue; otherwise
     * leave it `unchecked` for manual (or Phase 1 auto) review. Returns the
     * earlier slip when it is a duplicate, so the caller can show "used before".
     */
    public function screen(PaymentSlip $slip): ?PaymentSlip
    {
        $prior = PaymentSlip::query()
            ->where('organization_id', $slip->organization_id)
            ->where('id', '!=', $slip->id)
            ->where('payment_id', '!=', $slip->payment_id) // re-uploading to the same payment is fine
            ->whereHas('payment', fn ($q) => $q->whereIn('status', ['approved', 'pending_review']))
            ->where(function ($q) use ($slip) {
                $q->where('sha256', $slip->sha256);
                if ($slip->trans_ref) {
                    $q->orWhere('trans_ref', $slip->trans_ref);
                }
            })
            ->orderBy('created_at')
            ->first();

        $slip->update([
            'verify_status' => $prior ? 'duplicate' : 'unchecked',
            'verify_source' => $slip->trans_ref ? 'qr' : 'hash',
        ]);

        return $prior;
    }
}
