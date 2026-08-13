"use client";
import type { BookingStatus, PaymentStatus } from "@/lib/types";
import { useMessages } from "@/lib/i18n/context";

const cls: Record<BookingStatus, string> = {
  pending_payment: "bg-amber-100 text-amber-700",
  confirmed: "bg-brand/10 text-brand",
  completed: "bg-slate-100 text-slate-600",
  cancelled: "bg-red-100 text-red-600",
};

/**
 * A booking's state as the customer experiences it.
 *
 * `pending_payment` covers two very different situations — nobody has paid, and
 * the slip is sitting with the venue. Saying "รอชำระเงิน" to someone who has
 * already transferred reads as "we did not get your money", so the payment
 * state overrides the label when it has something more specific to say.
 */
export function StatusBadge({
  status,
  paymentStatus,
}: {
  status: BookingStatus;
  paymentStatus?: PaymentStatus | null;
}) {
  const s = useMessages("app").status;

  if (status === "pending_payment" && paymentStatus === "pending_review") {
    return (
      <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
        {s.pendingReview}
      </span>
    );
  }

  if (status === "pending_payment" && paymentStatus === "rejected") {
    return (
      <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-600">
        {s.rejected}
      </span>
    );
  }

  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls[status]}`}>
      {s[status]}
    </span>
  );
}
