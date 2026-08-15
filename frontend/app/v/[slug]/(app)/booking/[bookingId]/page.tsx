"use client";
import { use, useState } from "react";
import { VenueLink as Link } from "@/lib/tenant/venue-nav";
import { CalendarDays, Clock, Clock3, Share2, X, QrCode, RotateCcw } from "lucide-react";
import type { Booking } from "@/lib/types";
import { api } from "@/lib/api/client";
import { useTenant } from "@/lib/tenant/tenant-context";
import { useBooking, useRefunds } from "@/lib/api/queries";
import { useMessages, useLocale } from "@/lib/i18n/context";
import { fmt, intlLocale } from "@/lib/i18n/format";
import { StatusBadge } from "@/components/status-badge";
import { VenueMedia } from "@/components/venue-media";
import { AppHeader } from "@/components/app-header";
import { Loading, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import type { RefundStatus } from "@/lib/types";

const REFUND_CLS: Record<RefundStatus, string> = {
  requested: "bg-amber-100 text-amber-700",
  approved: "bg-brand/10 text-brand",
  rejected: "bg-red-100 text-red-600",
};

const baht = (n: number) => `฿${n.toLocaleString("th-TH")}`;

/**
 * The whole money story of one booking.
 *
 * Everything that moved the price has to be visible here, not only at the
 * moment of booking: what the court cost, what was rented, what a code took
 * off, what credit was spent, what has been paid and what is left. A bare total
 * cannot be checked against anything, and every one of these lines is a
 * question someone eventually asks at the counter.
 */
function MoneyBreakdown({ booking }: { booking: Booking }) {
  const t = useMessages("app").bookingDetail;
  const rentals = booking.rentals ?? [];
  const court = booking.courtAmount ?? booking.amount;
  const discount = booking.discountAmount ?? 0;
  const credit = booking.credit;
  const paid = booking.paidAmount ?? 0;
  const outstanding = booking.outstandingAmount ?? 0;

  // Only worth breaking out when something other than the court is in play.
  const itemised = rentals.length > 0 || discount > 0 || !!credit;

  return (
    <div className="mt-3 space-y-1 border-t border-black/5 pt-3 text-sm">
      {itemised && (
        <>
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">{t.court}</span>
            <span className="tabular-nums">{baht(court)}</span>
          </div>

          {rentals.map((r) => (
            <div key={r.id} className="flex items-baseline justify-between">
              <span className="min-w-0 truncate text-muted-foreground">
                {r.name} × {r.quantity}
              </span>
              <span className="tabular-nums">{baht(r.lineTotal)}</span>
            </div>
          ))}

          {discount > 0 && (
            <div className="flex items-baseline justify-between text-emerald-700">
              <span className="min-w-0 truncate">{booking.discountLabel ?? t.discount}</span>
              <span className="tabular-nums">−{baht(discount)}</span>
            </div>
          )}

          {/* Credit is hours, not baht — that is what the venue sells and what
              the customer's balance is counted in. Without this line a booking
              paid with a package simply looked free. */}
          {credit && (
            <div className="flex items-baseline justify-between text-brand">
              <span className="min-w-0 truncate">
                {t.useCredit}{credit.packageName ? ` · ${credit.packageName}` : ""}
              </span>
              {/* An unknown figure says nothing rather than "−0 hrs", which
                  reads as a bug on a receipt. */}
              <span className="shrink-0 tabular-nums">
                {credit.hoursUsed > 0 ? `−${credit.hoursUsed} ${t.hoursUnit}` : t.payWithCredit}
              </span>
            </div>
          )}
        </>
      )}

      <div className="flex items-baseline justify-between pt-1">
        <span className="text-muted-foreground">{t.total}</span>
        <span className="text-2xl font-bold text-brand tabular-nums">{baht(booking.amount)}</span>
      </div>

      {/* Shown only when part of it is settled: on an untouched booking
          "จ่ายแล้ว ฿0" is noise, not information. */}
      {paid > 0 && (
        <div className="flex items-baseline justify-between border-t border-black/5 pt-1">
          <span className="text-muted-foreground">{t.paid}</span>
          <span className="tabular-nums">{baht(paid)}</span>
        </div>
      )}
      {paid > 0 && outstanding > 0 && (
        <div className="flex items-baseline justify-between font-medium text-amber-700">
          <span>{t.outstanding}</span>
          <span className="tabular-nums">{baht(outstanding)}</span>
        </div>
      )}

      {credit && booking.amount === 0 && (
        <p className="pt-1 text-xs text-muted-foreground">
          {t.allCreditNote}
          {credit.remainingHours != null && ` · ${fmt(t.creditRemaining, { h: credit.remainingHours })}`}
        </p>
      )}
    </div>
  );
}

/** The one next action a customer actually has, given where their money is. */
function PaymentNextStep({ booking }: { booking: Booking }) {
  const t = useMessages("app").bookingDetail;
  const cta = "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-base font-semibold text-white";
  const outstanding = booking.outstandingAmount ?? booking.amount;
  const paid = booking.paidAmount ?? 0;

  // Deposit paid, court held, balance still to come. Not a warning — this is
  // the arrangement working, so it reads as reassurance with a number.
  if (paid > 0 && outstanding > 0 && booking.paymentStatus !== "pending_review") {
    return (
      <div className="space-y-2">
        <div className="rounded-2xl bg-emerald-50 p-4 text-center">
          <p className="font-semibold text-emerald-800">{t.depositPaid}</p>
          <p className="mt-0.5 text-sm text-emerald-700">
            {fmt(t.depositPaidSub, { n: outstanding.toLocaleString("th-TH") })}
          </p>
        </div>
        <Link href={`/payment/${booking.id}`} className={cta}>
          {fmt(t.payRest, { n: outstanding.toLocaleString("th-TH") })}
        </Link>
      </div>
    );
  }

  // Slip is with the venue. There is nothing for them to do, and offering a
  // button here is what caused double payments.
  if (booking.paymentStatus === "pending_review") {
    return (
      <div className="rounded-2xl bg-amber-50 p-4 text-center">
        <Clock3 className="mx-auto size-6 text-amber-600" />
        <p className="mt-2 font-semibold text-amber-800">{t.slipSent}</p>
        <p className="mt-0.5 text-sm text-amber-700">
          {t.slipSentSub}
        </p>
      </div>
    );
  }

  // The venue said no. This is the only case where paying again is right.
  if (booking.paymentStatus === "rejected") {
    return (
      <div className="space-y-2">
        <p className="rounded-2xl bg-rose-50 p-3 text-center text-sm text-rose-700">
          {t.slipRejected}
        </p>
        <Link href={`/payment/${booking.id}`} className={cta}>
          {t.payAgain}
        </Link>
      </div>
    );
  }

  // Started but never sent a slip — continue where they left off.
  if (booking.paymentStatus === "awaiting_slip") {
    return (
      <Link href={`/payment/${booking.id}`} className={cta}>
        {t.uploadSlip}
      </Link>
    );
  }

  // A deposit means the first payment is not the whole price, and saying so
  // here is the difference between "฿250" and an unexplained "฿100".
  const first = booking.depositAmount && booking.depositAmount > 0 ? booking.depositAmount : outstanding;

  return (
    <div className="space-y-2">
      {booking.depositAmount != null && booking.depositAmount > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          {fmt(t.depositHint, { n: booking.depositAmount.toLocaleString("th-TH") })}
        </p>
      )}
      <Link href={`/payment/${booking.id}`} className={cta}>
        {fmt(t.goPay, { n: first.toLocaleString("th-TH") })}
      </Link>
    </div>
  );
}

export default function BookingDetailPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  const { data: booking, isLoading, refetch } = useBooking(bookingId);
  const { tenant } = useTenant();
  const { data: refunds, refetch: refetchRefunds } = useRefunds();
  const t = useMessages("app").bookingDetail;
  const { locale } = useLocale();
  const [busy, setBusy] = useState(false);
  if (isLoading) return <Loading />;
  if (!booking) return <EmptyState message={t.notFound} />;

  const isConfirmed = booking.status === "confirmed";

  // Refund for this booking, if any. An active one (requested/approved) hides
  // the request button; we always surface the latest status below.
  const refund = refunds?.find((r) => r.bookingId === booking.id);
  // Eligible = a paid/active booking with money to return and no open refund.
  const canRefund =
    (booking.status === "confirmed" || booking.status === "completed") &&
    booking.amount > 0 &&
    (!refund || refund.status === "rejected");

  async function cancel() {
    if (!booking || !window.confirm(t.cancelConfirm)) return;
    setBusy(true);
    await api.cancelBooking(booking.id);
    await refetch();
    setBusy(false);
  }
  async function requestRefund() {
    if (!booking) return;
    const reason = window.prompt(t.refundReasonPrompt) ?? undefined;
    setBusy(true);
    try {
      await api.requestRefund(booking.id, reason || undefined);
      await refetchRefunds();
    } finally {
      setBusy(false);
    }
  }
  function share() {
    if (typeof navigator !== "undefined" && navigator.share && booking) {
      navigator
        .share({
          title: t.shareTitle,
          text: `${booking.venueName} · ${booking.courtName} · ${booking.date} ${booking.start}-${booking.end} (${booking.code})`,
        })
        .catch(() => {});
    }
  }

  return (
    <main className="pb-24">
      <AppHeader title={t.title} />
      <div className="space-y-4 p-4">
        <StatusBadge status={booking.status} paymentStatus={booking.paymentStatus} />

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          {/* The court that was actually booked. This was `sport="badminton"`
              for everyone — a tennis club's customer finished booking a tennis
              court and was shown a shuttlecock. Falls back to the venue's
              primary sport when the booking predates the field. */}
          <VenueMedia
            src={booking.courtImageUrl}
            sport={booking.courtSport ?? tenant.sport ?? ""}
            alt={booking.courtName}
            className="h-40 w-full"
          />
          <div className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand">{booking.venueName}</div>
            <h1 className="mt-0.5 text-lg font-bold">{booking.courtName}</h1>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 shrink-0" /> {booking.date}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-4 shrink-0" /> {booking.start}–{booking.end}
              </div>
            </div>
            <MoneyBreakdown booking={booking} />
          </div>
        </div>

        {/* What to do next depends on the PAYMENT, not just the booking. A
            booking sits at pending_payment both before anyone pays and while
            the venue is checking the slip — telling someone who has already
            transferred to "ไปชำระเงิน" is how they end up paying twice. */}
        {/* A deposit booking is confirmed and still owes money, so the next
            step follows the balance rather than the status. */}
        {(booking.status === "pending_payment" || (booking.outstandingAmount ?? 0) > 0) &&
          booking.status !== "cancelled" && <PaymentNextStep booking={booking} />}

        {isConfirmed && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-11 rounded-xl border-black/10" onClick={share}>
                <Share2 className="size-4" /> {t.share}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={cancel}
                className="h-11 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-600"
              >
                <X className="size-4" /> {t.cancel}
              </Button>
            </div>
            {/* Only when this venue actually scans — a QR nobody will look at
                is worse than no QR. */}
            {tenant.checkinEnabled && (
              <Link
                href={`/booking/${booking.id}/qr`}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-base font-semibold text-white hover:bg-brand/90"
              >
                <QrCode className="size-5" /> {t.qrCheckin}
              </Link>
            )}
          </>
        )}

        {booking.status === "completed" && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              {booking.checkedInAt
                ? fmt(t.checkedInAt, {
                    time: new Date(booking.checkedInAt).toLocaleTimeString(intlLocale(locale), {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  })
                : t.checkedIn}
            </p>
            {tenant.checkinEnabled && (
              <Link
                href={`/booking/${booking.id}/qr`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand"
              >
                <QrCode className="size-4" /> {t.viewCheckin}
              </Link>
            )}
          </div>
        )}

        {/* Refund: show existing request status, else offer to request one. */}
        {refund && refund.status !== "rejected" ? (
          <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <span className="text-sm text-muted-foreground">{t.refundLabel}</span>
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${REFUND_CLS[refund.status]}`}>
              {t.refund[refund.status]}
            </span>
          </div>
        ) : canRefund ? (
          <div className="space-y-2">
            {refund?.status === "rejected" && (
              <p className="text-center text-sm text-red-600">{t.refundRejectedNote}</p>
            )}
            <Button
              variant="outline"
              disabled={busy}
              onClick={requestRefund}
              className="h-11 w-full rounded-xl border-black/10"
            >
              <RotateCcw className="size-4" /> {t.requestRefund}
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
