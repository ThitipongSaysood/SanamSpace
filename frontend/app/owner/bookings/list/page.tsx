"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Maximize2, Plus, Search, Trash2, X } from "lucide-react";
import type { BookingRental, OwnerBooking } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { ImageLightbox } from "@/components/image-lightbox";
import { RowActions, rowAction } from "@/components/ui/row-action";
import { BookingDialog, type Dialog } from "../booking-dialog";

const BOOKINGS_KEY = ["owner", "bookings"];
const fmt = new Intl.NumberFormat("th-TH");

const STATUS_TABS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "pending_payment", label: "รอชำระเงิน" },
  { key: "pending_review", label: "รอตรวจสลิป" },
  { key: "confirmed", label: "ยืนยันแล้ว" },
  { key: "completed", label: "เสร็จสิ้น" },
  { key: "cancelled", label: "ยกเลิก" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "รอชำระเงิน",
  pending_review: "รอตรวจสลิป",
  rejected_slip: "สลิปไม่ผ่าน",
  confirmed: "ยืนยันแล้ว",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
};

/**
 * Who is being waited on, which is not what `booking.status` says.
 *
 * A booking sits at `pending_payment` from the moment it is made until the
 * money is approved — so "nobody has paid" and "the slip is in our queue right
 * now" wore the same รอชำระเงิน label. Staff could not tell the rows to chase
 * from the rows to action. The payment status is what separates them.
 */
function effectiveStatus(b: OwnerBooking): string {
  if (b.status !== "pending_payment") return b.status;
  if (b.paymentStatus === "pending_review") return "pending_review";
  if (b.paymentStatus === "rejected") return "rejected_slip";
  return "pending_payment";
}

function statusPill(status: string): string {
  switch (status) {
    case "confirmed":
      return "bg-blue-100 text-blue-700";
    case "completed":
      return "bg-emerald-100 text-emerald-700";
    // Ours to act on — deliberately not the same amber as "waiting on them".
    case "pending_review":
      return "bg-sky-100 text-sky-700";
    case "rejected_slip":
      return "bg-orange-100 text-orange-700";
    case "pending_payment":
      return "bg-amber-100 text-amber-700";
    case "cancelled":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** This month, as the default window — the same span the calendar's month view shows. */
function defaultRange(): { from: string; to: string } {
  const now = new Date();
  return {
    from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

/**
 * Every booking as a list: search it, filter it, fix it.
 *
 * Separate from the calendar because they answer different questions. The
 * calendar answers "what is on court 3 at 18:00"; this answers "where is
 * คุณสมชาย's booking" and "what did we cancel this month" — including the
 * cancelled and unpaid rows a time grid has nowhere to draw.
 */
export default function OwnerBookingListPage() {
  const qc = useQueryClient();
  const [range, setRange] = useState(defaultRange);
  const [tab, setTab] = useState<string>("all");
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [viewing, setViewing] = useState<OwnerBooking | null>(null);

  // The date window is the server's job — the venue's whole history is not
  // something to pull down and filter in the browser.
  const bookingsQ = useQuery({
    queryKey: [...BOOKINGS_KEY, "list", range.from, range.to],
    queryFn: () => ownerApi.getBookings({ from: range.from, to: range.to, perPage: 500 }),
    placeholderData: (prev) => prev,
  });
  const courtsQ = useQuery({ queryKey: ["owner", "courts"], queryFn: ownerApi.getCourts });

  const bookings = useMemo(() => bookingsQ.data ?? [], [bookingsQ.data]);
  const courts = courtsQ.data ?? [];

  // Counted before the status filter, so a tab says how many exist rather than
  // how many survive the tab you already picked.
  const searched = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return bookings;
    return bookings.filter((b) =>
      [b.code, b.customerName, b.courtName, b.date].some((v) => v?.toLowerCase().includes(needle)),
    );
  }, [bookings, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: searched.length };
    for (const b of searched) {
      const s = effectiveStatus(b);
      c[s] = (c[s] ?? 0) + 1;
      // A rejected slip is still an unpaid booking to chase, so it belongs
      // under รอชำระเงิน as well as carrying its own label.
      if (s === "rejected_slip") c.pending_payment = (c.pending_payment ?? 0) + 1;
    }
    return c;
  }, [searched]);

  const rows = useMemo(() => {
    const filtered =
      tab === "all"
        ? searched
        : searched.filter((b) => {
            const s = effectiveStatus(b);
            return s === tab || (tab === "pending_payment" && s === "rejected_slip");
          });
    return [...filtered].sort((a, b) => `${b.date}T${b.start}`.localeCompare(`${a.date}T${a.start}`));
  }, [searched, tab]);

  const isLoading = bookingsQ.isLoading || courtsQ.isLoading;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">รายการจอง</h1>
          <p className="text-sm text-muted-foreground">ทุกสถานะ — ค้นหา กรองวันที่ แก้ไข และลบได้</p>
        </div>
        <Button
          type="button"
          onClick={() => setDialog({ mode: "create", courtId: courts[0]?.id ?? "", date: range.from, start: "18:00" })}
          disabled={courts.length === 0}
        >
          <Plus className="size-4" /> เพิ่มการจอง
        </Button>
      </header>

      <section className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="q">ค้นหา</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="รหัสจอง ชื่อลูกค้า หรือคอร์ท"
              className="pl-9"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="ล้างคำค้น"
                className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-app"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="from">ตั้งแต่วันที่</Label>
          <Input
            id="from"
            type="date"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">ถึงวันที่</Label>
          <Input
            id="to"
            type="date"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </div>
      </section>

      <div className="flex flex-wrap gap-1 border-b border-black/5">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-muted-foreground">{counts[t.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {isLoading && <Loading />}
      {bookingsQ.isError && <ErrorState onRetry={() => bookingsQ.refetch()} />}
      {!isLoading && !bookingsQ.isError && rows.length === 0 && (
        <EmptyState message={q ? `ไม่พบรายการที่ตรงกับ “${q}”` : "ไม่มีรายการในช่วงนี้"} />
      )}

      {rows.length > 0 && (
        <>
          {/* Phone: cards. A table puts the amount, the status and the actions
              off the right edge, behind a sideways drag. */}
          <div className="space-y-2 md:hidden">
            {rows.map((b) => (
              <BookingCard key={b.id} booking={b} onView={() => setViewing(b)} />
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">รหัส</th>
                    <th className="px-4 py-3">ลูกค้า</th>
                    <th className="px-4 py-3">คอร์ท</th>
                    <th className="px-4 py-3">วันและเวลา</th>
                    <th className="px-4 py-3 text-right">ยอด</th>
                    <th className="px-4 py-3">สถานะ</th>
                    <th className="w-56 px-4 py-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {rows.map((b) => (
                    <BookingRow
                      key={b.id}
                      booking={b}
                      onView={() => setViewing(b)}
                      onEdit={() => setDialog({ mode: "edit", booking: b })}
                      onDone={() => qc.invalidateQueries({ queryKey: BOOKINGS_KEY })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {viewing && (
        <BookingDetail
          booking={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setDialog({ mode: "edit", booking: viewing });
            setViewing(null);
          }}
        />
      )}

      {dialog && <BookingDialog dialog={dialog} courts={courts} onClose={() => setDialog(null)} />}
    </div>
  );
}

/**
 * Everything on one booking, read-only.
 *
 * Re-fetched by id rather than rendered from the list row: the list is a
 * snapshot from whenever it loaded, and this is the screen someone opens to
 * check a fact before telling a customer.
 */
function BookingDetail({
  booking,
  onClose,
  onEdit,
}: {
  booking: OwnerBooking;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["owner", "booking", booking.id],
    queryFn: () => ownerApi.getBooking(booking.id),
    // The row we already have, so the panel opens with content rather than a
    // spinner, then sharpens when the fresh copy lands.
    placeholderData: booking,
  });

  const b = data ?? booking;
  const rentals = b.rentals ?? [];
  const courtAmount = b.courtAmount ?? b.amount;

  return (
    <Modal
      title={`การจอง ${b.code}`}
      width="max-w-lg"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            ปิด
          </Button>
          <Button type="button" onClick={onEdit}>
            แก้ไขการจอง
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span className={`rounded-full px-2.5 py-1 text-sm font-medium ${statusPill(effectiveStatus(b))}`}>
            {STATUS_LABEL[effectiveStatus(b)] ?? b.status}
          </span>
          {isLoading && <span className="text-xs text-muted-foreground">กำลังอัปเดต…</span>}
        </div>

        <SlipReview booking={b} />

        <dl className="divide-y divide-black/5 rounded-xl bg-app">
          <Field label="ลูกค้า" value={b.customerName ?? "Walk-in"} />
          <Field label="คอร์ท" value={b.courtName} />
          <Field label="วันที่" value={b.date} />
          <Field label="เวลา" value={`${b.start} – ${b.end}`} />
          {b.checkedInAt && (
            <Field
              label="เช็คอินแล้วเมื่อ"
              value={new Date(b.checkedInAt).toLocaleString("th-TH", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            />
          )}
        </dl>

        {/* The breakdown, because a total is no longer just the court. */}
        <section className="space-y-1.5 rounded-xl border border-black/5 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">ค่าสนาม</span>
            <span className="tabular-nums">฿{fmt.format(courtAmount)}</span>
          </div>

          {rentals.map((r) => (
            <RentalLine key={r.id} bookingId={b.id} rental={r} />
          ))}

          {/* Everything that moved the price, so a total the customer disputes
              can be explained without opening the database. */}
          {(b.discountAmount ?? 0) > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span className="min-w-0 truncate">{b.discountLabel ?? "ส่วนลด"}</span>
              <span className="tabular-nums">−฿{fmt.format(b.discountAmount!)}</span>
            </div>
          )}

          {b.credit && (
            <div className="flex justify-between text-brand">
              <span className="min-w-0 truncate">
                ใช้เครดิต{b.credit.packageName ? ` · ${b.credit.packageName}` : ""}
              </span>
              <span className="shrink-0 tabular-nums">
                {b.credit.hoursUsed > 0 ? `−${b.credit.hoursUsed} ชม.` : "จ่ายด้วยเครดิต"}
              </span>
            </div>
          )}

          <div className="flex items-baseline justify-between border-t border-black/5 pt-1.5">
            <span className="font-medium">ยอดรวม</span>
            <span className="text-xl font-bold text-brand tabular-nums">฿{fmt.format(b.amount)}</span>
          </div>

          <Balance booking={b} />

          {rentals.length === 0 && (
            <p className="text-xs text-muted-foreground">ไม่มีการเช่าอุปกรณ์</p>
          )}
        </section>
      </div>
    </Modal>
  );
}

/**
 * What is still owed, and the button that takes it.
 *
 * With deposits a booking can be confirmed and still owe money, so a total on
 * its own stops being the whole story. Only shown when there is a balance —
 * a paid booking should not carry a payment control.
 */
function Balance({ booking }: { booking: OwnerBooking }) {
  const qc = useQueryClient();
  const outstanding = booking.outstandingAmount ?? 0;
  const paid = booking.paidAmount ?? 0;

  const settle = useMutation({
    mutationFn: () => ownerApi.settleBooking(booking.id, { method: "cash" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOKINGS_KEY });
      qc.invalidateQueries({ queryKey: ["owner", "booking", booking.id] });
      qc.invalidateQueries({ queryKey: ["owner", "dashboard"] });
    },
  });

  if (outstanding <= 0) return null;

  return (
    <div className="space-y-2 border-t border-black/5 pt-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">จ่ายแล้ว</span>
        <span className="tabular-nums">฿{fmt.format(paid)}</span>
      </div>
      <div className="flex justify-between text-sm font-medium text-amber-700">
        <span>ค้างชำระ</span>
        <span className="tabular-nums">฿{fmt.format(outstanding)}</span>
      </div>
      <button
        type="button"
        disabled={settle.isPending}
        onClick={() => settle.mutate()}
        className="h-10 w-full rounded-lg bg-brand text-sm font-semibold text-brand-foreground disabled:opacity-50"
      >
        {settle.isPending ? "กำลังบันทึก…" : `รับเงินสด ฿${fmt.format(outstanding)}`}
      </button>
      {settle.isError && (
        <p className="text-xs text-brand-danger">{(settle.error as Error).message}</p>
      )}
    </div>
  );
}

/**
 * A rented line, and the button that takes it back.
 *
 * The return control lives on the charge it belongs to rather than on a
 * separate screen: the person handing a racket over the counter is looking at
 * this booking, and a second screen to record it is a step that gets skipped.
 */
function RentalLine({ bookingId, rental }: { bookingId: string; rental: BookingRental }) {
  const qc = useQueryClient();
  const returnedQty = rental.returnedQty ?? 0;
  const outstanding = Math.max(0, rental.quantity - returnedQty);

  const take = useMutation({
    mutationFn: (quantity?: number) => ownerApi.returnRental(bookingId, rental.id, quantity),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOKINGS_KEY });
      qc.invalidateQueries({ queryKey: ["owner", "booking", bookingId] });
      qc.invalidateQueries({ queryKey: ["owner", "rentals", "outstanding"] });
    },
  });

  return (
    <div>
      <div className="flex justify-between">
        <span className="min-w-0 truncate text-muted-foreground">
          {rental.name} × {rental.quantity}
        </span>
        <span className="tabular-nums">฿{fmt.format(rental.lineTotal)}</span>
      </div>

      <div className="mt-0.5 flex items-center justify-between gap-2">
        {outstanding === 0 ? (
          <span className="text-xs text-emerald-700">รับคืนครบแล้ว</span>
        ) : (
          <span className="text-xs text-amber-700">
            ยังไม่ได้คืน {outstanding} ชิ้น
            {returnedQty > 0 && ` (คืนแล้ว ${returnedQty})`}
          </span>
        )}

        {outstanding > 0 && (
          <span className="flex gap-1.5">
            {/* Only worth offering when there is more than one to split. */}
            {outstanding > 1 && (
              <button
                type="button"
                disabled={take.isPending}
                onClick={() => take.mutate(1)}
                className={rowAction()}
              >
                คืน 1
              </button>
            )}
            <button
              type="button"
              disabled={take.isPending}
              onClick={() => take.mutate(undefined)}
              className={rowAction()}
            >
              {take.isPending ? "..." : `รับคืน ${outstanding}`}
            </button>
          </span>
        )}
      </div>

      {take.isError && (
        <p className="text-xs text-brand-danger">{(take.error as Error).message}</p>
      )}
    </div>
  );
}

/**
 * The slip, and the decision, next to the booking they belong to.
 *
 * This panel used to say "อนุมัติได้ที่หน้าตรวจสลิป" — which meant leaving the
 * booking you were looking at, finding the same row again in another queue, and
 * matching it up by name and time before you could approve it. The slip is the
 * thing being decided, so it belongs here.
 *
 * Once decided it stays visible but read-only: staff still need to see what was
 * approved, and the queue screen is the place to work through a backlog.
 */
function SlipReview({ booking }: { booking: OwnerBooking }) {
  const qc = useQueryClient();
  const [zoom, setZoom] = useState(false);

  const paymentId = booking.paymentId;
  const awaitingDecision = effectiveStatus(booking) === "pending_review";

  function settled() {
    qc.invalidateQueries({ queryKey: BOOKINGS_KEY });
    qc.invalidateQueries({ queryKey: ["owner", "booking", booking.id] });
    qc.invalidateQueries({ queryKey: ["owner", "payments"] });
    qc.invalidateQueries({ queryKey: ["owner", "dashboard"] });
  }

  const verify = useMutation({ mutationFn: () => ownerApi.verifyPayment(paymentId!), onSuccess: settled });
  const reject = useMutation({ mutationFn: () => ownerApi.rejectPayment(paymentId!), onSuccess: settled });
  const busy = verify.isPending || reject.isPending;
  const failed = (verify.error ?? reject.error) as Error | null;

  // Nothing has been sent, so there is nothing to look at.
  if (!booking.paymentSlipUrl) {
    return awaitingDecision ? (
      <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-800">
        ลูกค้าแจ้งชำระเงินแล้วแต่ยังไม่มีรูปสลิป
      </p>
    ) : null;
  }

  return (
    <section className="space-y-3 rounded-xl border border-black/5 p-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setZoom(true)}
          aria-label="ดูสลิปเต็ม"
          className="group relative block size-20 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={booking.paymentSlipUrl} alt="" className="size-full object-cover" />
          <span className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
            <Maximize2 className="size-4" />
          </span>
        </button>

        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">สลิปการโอน</p>
          <p className="text-muted-foreground">
            {booking.paymentMethod === "promptpay" ? "PromptPay" : "โอนเงิน"} · ฿{fmt.format(booking.amount)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {awaitingDecision ? "กดที่รูปเพื่อดูเต็มก่อนอนุมัติ" : "กดที่รูปเพื่อดูเต็ม"}
          </p>
        </div>
      </div>

      {awaitingDecision && paymentId && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => reject.mutate()}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold text-brand-danger ring-1 ring-brand-danger/20 transition hover:bg-brand-danger/10 disabled:opacity-50"
          >
            <X className="size-4" /> {reject.isPending ? "..." : "ปฏิเสธสลิป"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => verify.mutate()}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-brand text-sm font-semibold text-brand-foreground transition hover:bg-brand/90 disabled:opacity-50"
          >
            <Check className="size-4" /> {verify.isPending ? "..." : "อนุมัติ"}
          </button>
        </div>
      )}

      {failed && <p className="text-sm text-brand-danger">{failed.message}</p>}

      {zoom && (
        <ImageLightbox
          src={booking.paymentSlipUrl}
          alt={`สลิปการชำระเงินของ ${booking.customerName ?? "ลูกค้า"}`}
          onClose={() => setZoom(false)}
        />
      )}
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{value}</dd>
    </div>
  );
}

function BookingRow({
  booking,
  onView,
  onEdit,
  onDone,
}: {
  booking: OwnerBooking;
  onView: () => void;
  onEdit: () => void;
  onDone: () => void;
}) {
  const remove = useMutation({
    mutationFn: () => ownerApi.deleteBooking(booking.id),
    onSuccess: onDone,
  });

  return (
    // The row opens the details; the buttons stop the click so they still do
    // their own thing.
    <tr className="cursor-pointer hover:bg-app/60" onClick={onView}>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{booking.code}</td>
      <td className="px-4 py-3 font-medium">{booking.customerName ?? "Walk-in"}</td>
      <td className="px-4 py-3">{booking.courtName}</td>
      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
        {booking.date} · {booking.start}–{booking.end}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-brand">฿{fmt.format(booking.amount)}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusPill(effectiveStatus(booking))}`}
        >
          {STATUS_LABEL[effectiveStatus(booking)] ?? booking.status}
        </span>
      </td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <RowActions>
          <button type="button" onClick={onView} className={rowAction()}>
            รายละเอียด
          </button>
          <button type="button" onClick={onEdit} className={rowAction()}>
            แก้ไข
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`ลบการจอง ${booking.code}? ถ้าแค่ไม่มาเล่น ให้แก้สถานะเป็น “ยกเลิก” แทน`)) {
                remove.mutate();
              }
            }}
            disabled={remove.isPending}
            aria-label="ลบการจอง"
            className={rowAction("icon", "hover:bg-brand-danger/10 hover:text-brand-danger")}
          >
            <Trash2 className="size-4" />
          </button>
        </RowActions>
        {remove.isError && (
          <div className="mt-1 max-w-52 text-right text-xs text-brand-danger">
            {(remove.error as Error).message}
          </div>
        )}
      </td>
    </tr>
  );
}

function BookingCard({ booking, onView }: { booking: OwnerBooking; onView: () => void }) {
  return (
    <button
      type="button"
      onClick={onView}
      className="block w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-black/5 transition active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold">{booking.customerName ?? "ลูกค้า Walk-in"}</span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusPill(effectiveStatus(booking))}`}
        >
          {STATUS_LABEL[effectiveStatus(booking)] ?? booking.status}
        </span>
      </div>
      <div className="mt-1 text-sm text-muted-foreground">
        {booking.courtName} · {booking.date} · {booking.start}–{booking.end}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">{booking.code}</span>
        <span className="font-semibold text-brand">฿{fmt.format(booking.amount)}</span>
      </div>
    </button>
  );
}
