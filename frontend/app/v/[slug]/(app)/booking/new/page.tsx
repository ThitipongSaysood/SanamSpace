"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useVenueRouter as useRouter } from "@/lib/tenant/venue-nav";
import { CheckCircle2, Circle, Minus, Package, Plus, Ticket, X } from "lucide-react";
import type { CouponPreview } from "@/lib/types";
import { api } from "@/lib/api/client";
import { useCourts, useSchedule, useCreateBooking, useRentals } from "@/lib/api/queries";
import { AppHeader } from "@/components/app-header";
import { SportMedia } from "@/components/media";
import { CourtSlotGrid, CourtSlotLegend } from "@/components/court-slot-grid";
import { canSelect, calcPrice, totalHours } from "@/lib/booking/slots";
import type { Slot } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Loading, EmptyState } from "@/components/states";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const WEEKDAY_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const THAI_WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

function genDates(count: number) {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { iso, weekday: WEEKDAY_SHORT[d.getDay()], day: d.getDate(), month: THAI_MONTHS[d.getMonth()] };
  });
}

function formatThaiDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${THAI_WEEKDAYS[d.getDay()]} ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className="grid size-6 place-items-center rounded-full bg-brand text-xs font-bold text-white">{n}</span>
      <h2 className="font-semibold">{children}</h2>
    </div>
  );
}

function NewBookingInner() {
  const router = useRouter();
  const venueId = useSearchParams().get("venueId") ?? "everyday-badminton";
  const { data: courts } = useCourts(venueId);
  const dates = useMemo(() => genDates(14), []);
  const [courtId, setCourtId] = useState<string | undefined>();
  const [date, setDate] = useState(dates[0].iso);
  const court = courts?.find((c) => c.id === courtId);
  const { data: schedule } = useSchedule(courtId, date);
  const [selected, setSelected] = useState<Slot[]>([]);
  const create = useCreateBooking();

  const dateRef = useRef<HTMLElement>(null);
  const timeRef = useRef<HTMLElement>(null);

  // The sticky bar grows with every rental line added, so a fixed `pb-28` left
  // the last item hidden underneath it. Measured and written straight to a CSS
  // variable — no state, so adding a line cannot cause a render loop.
  //
  // A ref *callback*, not useEffect + useRef: this screen returns <Loading />
  // until the courts arrive, so an effect with `[]` deps runs once while the bar
  // is not in the DOM yet and then never again. The callback fires when the node
  // actually mounts.
  const barRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) {
      document.documentElement.style.removeProperty("--booking-bar-h");
      return;
    }

    const apply = () =>
      document.documentElement.style.setProperty("--booking-bar-h", `${el.offsetHeight}px`);
    apply();

    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const scrollTo = (ref: React.RefObject<HTMLElement | null>) =>
    requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

  const toggle = (s: Slot) => {
    const exists = selected.some((x) => x.start === s.start);
    if (exists) setSelected(selected.filter((x) => x.start !== s.start));
    else if (canSelect(s, selected)) setSelected([...selected, s]);
  };

  const price = court ? calcPrice(selected, court.pricePerHour) : 0;
  const sorted = [...selected].sort((a, b) => a.start.localeCompare(b.start));
  const hours = totalHours(selected);
  const ready = !!court && selected.length > 0;
  const start = sorted[0]?.start;
  const end = sorted[sorted.length - 1]?.end;

  // Equipment for THIS window. Asked only once a slot is picked, because
  // "3 rackets left" means nothing without saying left when.
  const { data: rentalItems } = useRentals(date, start, end);
  const [rentals, setRentals] = useState<Record<string, number>>({});

  // Changing the slot invalidates the picks — what was free at 18:00 may not be
  // at 20:00, so keeping them would quote a basket the venue cannot equip.
  const slotKey = `${date}|${start ?? ""}|${end ?? ""}`;
  const [pickedFor, setPickedFor] = useState(slotKey);
  if (pickedFor !== slotKey) {
    setPickedFor(slotKey);
    if (Object.keys(rentals).length > 0) setRentals({});
  }

  const [coupon, setCoupon] = useState<CouponPreview | null>(null);

  const rentalLines = (rentalItems ?? [])
    .map((item) => ({ item, qty: rentals[item.id] ?? 0 }))
    .filter((l) => l.qty > 0);

  const rentalTotal = rentalLines.reduce((sum, l) => sum + (l.item.priceForBooking ?? l.item.price) * l.qty, 0);
  const subtotal = price + rentalTotal;
  const grandTotal = Math.max(0, subtotal - (coupon?.discount ?? 0));

  // Cleared whenever the price it was checked against changes: a code worth
  // ฿100 on a two-hour booking is not the same code on a one-hour one.
  useEffect(() => {
    setCoupon(null);
  }, [court?.id, date, start, end, rentalTotal]);

  async function confirm() {
    if (!ready || !court || !start || !end) return;
    const booking = await create.mutateAsync({
      venueId,
      courtId: court.id,
      date,
      start,
      end,
      rentals: rentalLines.map((l) => ({ itemId: l.item.id, quantity: l.qty })),
      ...(coupon ? { couponCode: coupon.code } : {}),
    });
    router.push(`/payment/${booking.id}`);
  }

  if (!courts) return <Loading />;
  if (courts.length === 0) return <EmptyState message="สนามนี้ยังไม่มีคอร์ทให้จอง" />;

  return (
    <main
      className="pb-28"
      // Reserve the bar's real height plus a thumb's worth of breathing room,
      // falling back to the old fixed padding before the measurement lands.
      style={{ paddingBottom: "calc(var(--booking-bar-h, 7rem) + 1.5rem)" }}
    >
      <AppHeader title="จองสนาม" />
      <div className="space-y-6 p-4">
        {/* 1. court */}
        <section>
          <SectionTitle n={1}>เลือกคอร์ท</SectionTitle>
          <div className="space-y-2.5">
            {courts.map((c) => {
              const active = courtId === c.id;
              return (
                <button
                  key={c.id}
                  aria-pressed={active}
                  onClick={() => {
                    setCourtId(c.id);
                    setSelected([]);
                    scrollTo(dateRef);
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left shadow-sm ring-1 transition ${
                    active ? "bg-brand/10 ring-brand" : "bg-white ring-black/5 hover:ring-brand/30"
                  }`}
                >
                  <SportMedia sport={c.sport} className="size-16 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{c.name}</div>
                    <div className="mt-0.5 text-sm font-medium text-brand">
                      ฿{c.pricePerHour}
                      <span className="text-xs font-normal text-muted-foreground">/ชั่วโมง</span>
                    </div>
                    {c.spec && (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {c.spec.floor} · สูง {c.spec.height} · {c.spec.standard}
                      </div>
                    )}
                  </div>
                  {active ? (
                    <CheckCircle2 className="size-6 shrink-0 text-brand" />
                  ) : (
                    <Circle className="size-6 shrink-0 text-black/15" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. date — horizontal strip */}
        <section ref={dateRef} className="scroll-mt-20">
          <SectionTitle n={2}>เลือกวันที่</SectionTitle>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {dates.map((d) => {
              const active = date === d.iso;
              return (
                <button
                  key={d.iso}
                  aria-pressed={active}
                  onClick={() => {
                    setDate(d.iso);
                    setSelected([]);
                    if (court) scrollTo(timeRef);
                  }}
                  className={`flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-2xl py-2.5 shadow-sm ring-1 transition ${
                    active ? "bg-brand text-white ring-brand" : "bg-white text-foreground ring-black/5"
                  }`}
                >
                  <span className={`text-xs ${active ? "text-white/80" : "text-muted-foreground"}`}>{d.weekday}</span>
                  <span className="text-lg font-bold tabular-nums">{d.day}</span>
                  <span className={`text-[10px] ${active ? "text-white/80" : "text-muted-foreground"}`}>{d.month}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. time */}
        <section ref={timeRef} className="scroll-mt-20">
          <SectionTitle n={3}>เลือกเวลา</SectionTitle>
          {!court ? (
            <div className="rounded-2xl bg-white p-6 text-center text-sm text-muted-foreground shadow-sm ring-1 ring-black/5">
              เลือกคอร์ทก่อนเพื่อดูเวลาว่าง
            </div>
          ) : schedule ? (
            <>
              {/* Legend first: it tells you how to read the grid below it. */}
              <div className="mb-2.5">
                <CourtSlotLegend />
              </div>
              <CourtSlotGrid
                slots={schedule.slots}
                selected={selected}
                onToggle={toggle}
                pricePerHour={court?.pricePerHour}
              />
            </>
          ) : (
            <Loading rows={1} />
          )}
        </section>

        {/* 4. equipment — only once there is a slot to check availability against */}
        {ready && (rentalItems?.length ?? 0) > 0 && (
          <section>
            <SectionTitle n={4}>เช่าอุปกรณ์ (ไม่บังคับ)</SectionTitle>
            <div className="space-y-2.5">
              {rentalItems!.map((item) => {
                const qty = rentals[item.id] ?? 0;
                const free = item.availableQty ?? 0;
                const each = item.priceForBooking ?? item.price;

                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ${
                      qty > 0 ? "ring-brand" : "ring-black/5"
                    } ${free === 0 ? "opacity-50" : ""}`}
                  >
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-app text-muted-foreground">
                        <Package className="size-6" />
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-sm font-medium text-brand">
                        ฿{each}
                        <span className="text-xs font-normal text-muted-foreground">
                          {item.priceUnit === "per_hour" ? ` / ${hours} ชม.` : " / ครั้ง"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {free === 0 ? "ช่วงเวลานี้ถูกเช่าหมดแล้ว" : `ว่าง ${free} ชิ้น`}
                        {item.note ? ` · ${item.note}` : ""}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`ลด ${item.name}`}
                        disabled={qty === 0}
                        onClick={() => setRentals((r) => ({ ...r, [item.id]: Math.max(0, qty - 1) }))}
                        className="grid size-9 place-items-center rounded-lg bg-app text-muted-foreground disabled:opacity-40"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span className="w-6 text-center font-semibold tabular-nums">{qty}</span>
                      <button
                        type="button"
                        aria-label={`เพิ่ม ${item.name}`}
                        disabled={qty >= free}
                        onClick={() => setRentals((r) => ({ ...r, [item.id]: qty + 1 }))}
                        className="grid size-9 place-items-center rounded-lg bg-app text-muted-foreground disabled:opacity-40"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 5. coupon — only once there is a price for it to apply to. */}
        {ready && (
          <section>
            <SectionTitle n={rentalItems && rentalItems.length > 0 ? 5 : 4}>
              คูปองส่วนลด (ถ้ามี)
            </SectionTitle>
            <CouponField
              courtId={court!.id}
              amount={subtotal}
              applied={coupon}
              onApply={setCoupon}
            />
          </section>
        )}
      </div>

      {/* sticky summary + single CTA */}
      <div
        ref={barRef}
        className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-black/5 bg-white/95 p-3 backdrop-blur"
      >
        {ready && (
          <div className="mb-2 space-y-1 text-sm">
            {/* Itemised: the customer is about to transfer this, and a bare
                number invites "why is it 550 and not 500?" at the counter. */}
            <div className="truncate text-xs text-muted-foreground">{formatThaiDate(date)}</div>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-muted-foreground">
                {court!.name} · {sorted[0].start}–{sorted[sorted.length - 1].end} ({hours} ชม.)
              </span>
              <span className="shrink-0 tabular-nums">฿{price}</span>
            </div>

            {rentalLines.map((l) => (
              <div key={l.item.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-muted-foreground">
                  {l.item.name} × {l.qty}
                </span>
                <span className="shrink-0 tabular-nums">
                  ฿{(l.item.priceForBooking ?? l.item.price) * l.qty}
                </span>
              </div>
            ))}

            {coupon && (
              <div className="flex items-center justify-between gap-2 text-emerald-700">
                <span className="min-w-0 truncate">คูปอง {coupon.code}</span>
                <span className="shrink-0 tabular-nums">−฿{coupon.discount}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-black/5 pt-1">
              <span className="font-medium">ยอดที่ต้องโอน</span>
              <span className="text-lg font-bold text-brand tabular-nums">฿{grandTotal}</span>
            </div>
          </div>
        )}
        <Button
          disabled={!ready || create.isPending}
          onClick={confirm}
          className="h-12 w-full rounded-xl bg-brand text-base font-semibold hover:bg-brand/90"
        >
          {create.isPending ? "กำลังจอง..." : ready ? "ดำเนินการชำระเงิน" : "เลือกคอร์ทและเวลา"}
        </Button>
      </div>
    </main>
  );
}

/**
 * Type a code, see what it does, before committing to the booking.
 *
 * Checked against the server rather than guessed at, because every rule that
 * can refuse a code — expiry, minimum spend, per-customer limit — lives there.
 * A wrong code says why while it can still be fixed, instead of on the receipt.
 */
function CouponField({
  courtId,
  amount,
  applied,
  onApply,
}: {
  courtId: string;
  amount: number;
  applied: CouponPreview | null;
  onApply: (c: CouponPreview | null) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      onApply(await api.previewCoupon(courtId, code.trim(), amount));
    } catch (e) {
      onApply(null);
      setError((e as Error).message || "ใช้คูปองนี้ไม่ได้");
    } finally {
      setBusy(false);
    }
  }

  if (applied) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
        <Ticket className="size-5 shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-emerald-800">{applied.code}</div>
          <div className="text-sm text-emerald-700">ลด ฿{applied.discount}</div>
        </div>
        <button
          type="button"
          aria-label="เอาคูปองออก"
          onClick={() => {
            onApply(null);
            setCode("");
          }}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-emerald-700 hover:bg-emerald-100"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && check()}
          placeholder="กรอกรหัสคูปอง"
          aria-label="รหัสคูปอง"
          className="h-11 min-w-0 flex-1 rounded-xl border border-black/10 px-3 text-sm uppercase outline-none focus:border-brand"
        />
        <Button
          type="button"
          onClick={check}
          disabled={busy || !code.trim()}
          className="h-11 shrink-0 rounded-xl px-5"
        >
          {busy ? "..." : "ใช้"}
        </Button>
      </div>
      {error && <p className="text-sm text-brand-danger">{error}</p>}
    </div>
  );
}

export default function NewBookingPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewBookingInner />
    </Suspense>
  );
}
