"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, ChevronRight } from "lucide-react";
import { useBookings } from "@/lib/api/queries";
import { useMessages } from "@/lib/i18n/context";
import { useCountdown } from "@/lib/use-countdown";
import { VenueLink } from "@/lib/tenant/venue-nav";

/**
 * Sticky "รอชำระเงิน" alert shown across the customer app while there is a live
 * unpaid hold, counting down to the pay-by deadline. Tapping it goes straight to
 * the payment screen. Hidden once the deadline passes (the booking is being
 * swept) and on the payment screen itself, which shows its own countdown.
 */
export function PendingPaymentBanner() {
  const path = usePathname();
  const qc = useQueryClient();
  const { data: bookings } = useBookings();
  const st = useMessages("app").status;

  // The soonest-expiring hold the customer still owes for — a slip already sent
  // (pending_review) is protected and no longer counts down.
  const pending = (bookings ?? [])
    .filter((b) => b.status === "pending_payment" && b.paymentStatus !== "pending_review" && b.expiresAt)
    .sort((a, b) => (a.expiresAt! < b.expiresAt! ? -1 : 1))[0];

  const { label, done, secondsLeft } = useCountdown(pending?.expiresAt);

  // When it runs out, refetch so the freed/cancelled booking lands and the
  // prompt stops offering a slot that is no longer held.
  useEffect(() => {
    if (pending && done) qc.invalidateQueries({ queryKey: ["bookings"] });
  }, [pending, done, qc]);

  if (!pending || done || path?.includes("/payment/")) return null;

  const urgent = secondsLeft <= 60;

  return (
    <VenueLink
      href={`/payment/${pending.id}`}
      className="sticky top-0 z-30 flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 shadow-sm"
    >
      <Clock className={`size-4 shrink-0 ${urgent ? "text-red-600" : "text-amber-600"}`} />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{st.pending_payment}</div>
        <div className="truncate text-xs text-amber-700">
          {pending.venueName} · ฿{pending.amount.toLocaleString("th-TH")}
        </div>
      </div>
      <span className={`shrink-0 tabular-nums font-bold ${urgent ? "text-red-600" : "text-amber-700"}`}>
        {label}
      </span>
      <ChevronRight className="size-4 shrink-0 text-amber-500" />
    </VenueLink>
  );
}
