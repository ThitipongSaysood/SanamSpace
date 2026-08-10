"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ImageOff, Maximize2, X } from "lucide-react";
import type { OwnerPackagePurchase, OwnerPayment } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { CustomerName } from "@/components/customer-peek";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { ImageLightbox } from "@/components/image-lightbox";

const fmt = new Intl.NumberFormat("th-TH");

type Viewing = { src: string; alt: string } | null;

/**
 * Slips awaiting review.
 *
 * A table rather than cards: this is a queue worked top to bottom, and full
 * slip images stacked two-up meant scrolling past a photo of a bank app to
 * reach the next one. The slip is still the point, so its thumbnail opens full
 * size — that is what the money is approved against.
 */
export default function OwnerPaymentsPage() {
  const [viewing, setViewing] = useState<Viewing>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "payments", "pending_review"],
    queryFn: () => ownerApi.getPayments("pending_review"),
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">ตรวจสลิป</h1>
        <p className="text-sm text-muted-foreground">
          ตรวจสอบสลิปการโอนเงิน — กดที่รูปเพื่อดูเต็มก่อนอนุมัติ
        </p>
      </header>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ไม่มีสลิปรอตรวจ" />}

      {/* Phone: one card per slip. In a table the amount and the approve button
          sit off the right edge, behind a sideways scroll — on the one screen
          whose entire purpose is a two-tap decision. */}
      {data && data.length > 0 && (
        <div className="space-y-3 md:hidden">
          {data.map((p) => (
            <PaymentCard key={p.id} payment={p} onView={setViewing} />
          ))}
        </div>
      )}

      {data && data.length > 0 && (
        <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="w-24 px-4 py-3">สลิป</th>
                  <th className="px-4 py-3">ลูกค้า</th>
                  <th className="px-4 py-3">การจอง</th>
                  <th className="px-4 py-3">วันและเวลา</th>
                  <th className="px-4 py-3 text-right">ยอด</th>
                  <th className="w-44 px-4 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.map((p) => (
                  <PaymentRow key={p.id} payment={p} onView={setViewing} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PackagePurchases onView={setViewing} />

      {viewing && <ImageLightbox src={viewing.src} alt={viewing.alt} onClose={() => setViewing(null)} />}
    </div>
  );
}

function PaymentRow({ payment, onView }: { payment: OwnerPayment; onView: (v: Viewing) => void }) {
  const qc = useQueryClient();

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["owner", "payments"] });
    qc.invalidateQueries({ queryKey: ["owner", "dashboard"] });
  }

  const verify = useMutation({ mutationFn: () => ownerApi.verifyPayment(payment.id), onSuccess: invalidate });
  const reject = useMutation({ mutationFn: () => ownerApi.rejectPayment(payment.id), onSuccess: invalidate });
  const busy = verify.isPending || reject.isPending;
  const failed = verify.isError || reject.isError;

  return (
    <tr className="hover:bg-app/60">
      <td className="px-4 py-3">
        <SlipThumb
          src={payment.slipUrl}
          alt={`สลิปการชำระเงินของ ${payment.customerName ?? "ลูกค้า"}`}
          onView={onView}
        />
      </td>

      <td className="px-4 py-3 font-medium"><CustomerName id={payment.customerId} name={payment.customerName} /></td>

      <td className="px-4 py-3">
        {payment.booking ? (
          <>
            <div className="font-mono text-xs text-muted-foreground">{payment.booking.code}</div>
            <div>{payment.booking.courtName}</div>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
        {payment.booking ? `${payment.booking.date} · ${payment.booking.start}–${payment.booking.end}` : "—"}
      </td>

      <td className="px-4 py-3 text-right">
        <div className="font-semibold text-brand">฿{fmt.format(payment.amount)}</div>
        <div className="text-xs text-muted-foreground">{payment.method}</div>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => reject.mutate()}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-danger ring-1 ring-brand-danger/20 transition hover:bg-brand-danger/10 disabled:opacity-50"
          >
            <X className="size-3.5" /> {reject.isPending ? "..." : "ปฏิเสธ"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => verify.mutate()}
            className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-semibold text-brand-foreground transition hover:bg-brand/90 disabled:opacity-50"
          >
            <Check className="size-3.5" /> {verify.isPending ? "..." : "อนุมัติ"}
          </button>
        </div>
        {failed && <div className="mt-1 text-right text-xs text-brand-danger">ไม่สำเร็จ ลองอีกครั้ง</div>}
      </td>
    </tr>
  );
}

/** The same row as a card, for a phone at the counter. */
function PaymentCard({ payment, onView }: { payment: OwnerPayment; onView: (v: Viewing) => void }) {
  const qc = useQueryClient();

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["owner", "payments"] });
    qc.invalidateQueries({ queryKey: ["owner", "dashboard"] });
  }

  const verify = useMutation({ mutationFn: () => ownerApi.verifyPayment(payment.id), onSuccess: invalidate });
  const reject = useMutation({ mutationFn: () => ownerApi.rejectPayment(payment.id), onSuccess: invalidate });
  const busy = verify.isPending || reject.isPending;
  const failed = verify.isError || reject.isError;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start gap-3">
        <SlipThumb
          src={payment.slipUrl}
          alt={`สลิปการชำระเงินของ ${payment.customerName ?? "ลูกค้า"}`}
          onView={onView}
        />
        <div className="min-w-0 flex-1">
          <div className="font-semibold"><CustomerName id={payment.customerId} name={payment.customerName} /></div>
          {payment.booking && (
            <div className="mt-0.5 text-sm text-muted-foreground">
              {payment.booking.courtName} · {payment.booking.date}
              <br />
              {payment.booking.start}–{payment.booking.end}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-bold text-brand">฿{fmt.format(payment.amount)}</div>
          <div className="text-xs text-muted-foreground">{payment.method}</div>
        </div>
      </div>

      {failed && <p className="mt-2 text-sm text-brand-danger">ไม่สำเร็จ ลองอีกครั้ง</p>}

      {/* Full-width targets: this is a decision made with a thumb. */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => reject.mutate()}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-brand-danger ring-1 ring-brand-danger/20 transition disabled:opacity-50"
        >
          <X className="size-4" /> {reject.isPending ? "..." : "ปฏิเสธ"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => verify.mutate()}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-brand text-sm font-semibold text-brand-foreground transition disabled:opacity-50"
        >
          <Check className="size-4" /> {verify.isPending ? "..." : "อนุมัติ"}
        </button>
      </div>
    </div>
  );
}

/** A handle to the slip, not the slip — the lightbox is where it is read. */
function SlipThumb({
  src,
  alt,
  onView,
}: {
  src?: string | null;
  alt: string;
  onView: (v: Viewing) => void;
}) {
  if (!src) {
    return (
      <span className="grid size-14 place-items-center rounded-lg bg-app text-muted-foreground" title="ไม่มีรูปสลิป">
        <ImageOff className="size-4" />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onView({ src, alt })}
      aria-label="ดูสลิปเต็ม"
      className="group relative block size-14 overflow-hidden rounded-lg ring-1 ring-black/10"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="size-full object-cover" />
      <span className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
        <Maximize2 className="size-4" />
      </span>
    </button>
  );
}

/** Customer package purchases awaiting the same kind of slip review. */
function PackagePurchases({ onView }: { onView: (v: Viewing) => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["owner", "package-purchases"],
    queryFn: ownerApi.getPackagePurchases,
  });

  if (!data || data.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <header className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
        <h2 className="font-semibold">ซื้อแพ็กเกจรออนุมัติ</h2>
        <span className="rounded-full bg-brand-accent/15 px-2 py-0.5 text-xs font-medium text-brand">
          {data.length}
        </span>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="w-24 px-4 py-3">สลิป</th>
              <th className="px-4 py-3">ลูกค้า</th>
              <th className="px-4 py-3">แพ็กเกจ</th>
              <th className="px-4 py-3 text-right">ยอด</th>
              <th className="w-44 px-4 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {data.map((p) => (
              <PurchaseRow
                key={p.id}
                purchase={p}
                onView={onView}
                onDone={() => qc.invalidateQueries({ queryKey: ["owner", "package-purchases"] })}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PurchaseRow({
  purchase,
  onView,
  onDone,
}: {
  purchase: OwnerPackagePurchase;
  onView: (v: Viewing) => void;
  onDone: () => void;
}) {
  const approve = useMutation({
    mutationFn: () => ownerApi.approvePackagePurchase(purchase.id),
    onSuccess: onDone,
  });
  const reject = useMutation({
    mutationFn: () => ownerApi.rejectPackagePurchase(purchase.id),
    onSuccess: onDone,
  });
  const busy = approve.isPending || reject.isPending;
  const failed = approve.isError || reject.isError;

  return (
    <tr className="hover:bg-app/60">
      <td className="px-4 py-3">
        <SlipThumb
          src={purchase.slipUrl}
          alt={`สลิปซื้อแพ็กเกจของ ${purchase.customerName ?? "ลูกค้า"}`}
          onView={onView}
        />
      </td>
      <td className="px-4 py-3 font-medium"><CustomerName id={purchase.customerId} name={purchase.customerName} fallback="ลูกค้า" /></td>
      <td className="px-4 py-3">
        <div>{purchase.packageName}</div>
        <div className="text-xs text-muted-foreground">{purchase.hours} ชั่วโมง</div>
      </td>
      <td className="px-4 py-3 text-right font-semibold text-brand">฿{fmt.format(purchase.price)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => reject.mutate()}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-danger ring-1 ring-brand-danger/20 transition hover:bg-brand-danger/10 disabled:opacity-50"
          >
            <X className="size-3.5" /> {reject.isPending ? "..." : "ปฏิเสธ"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => approve.mutate()}
            className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-semibold text-brand-foreground transition hover:bg-brand/90 disabled:opacity-50"
          >
            <Check className="size-3.5" /> {approve.isPending ? "..." : "อนุมัติ"}
          </button>
        </div>
        {/* The old version reported these through window.alert(), which stopped
            the whole screen for a message about one row. */}
        {failed && (
          <div className="mt-1 text-right text-xs text-brand-danger">
            {((approve.error ?? reject.error) as Error)?.message ?? "ไม่สำเร็จ"}
          </div>
        )}
      </td>
    </tr>
  );
}
