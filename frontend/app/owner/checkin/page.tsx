"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Keyboard, Power, Smartphone, XCircle } from "lucide-react";
import QRCode from "qrcode";
import type { ScanResult } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { CustomerName } from "@/components/customer-peek";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrScanner } from "@/components/qr-scanner";
import { useMessages } from "@/lib/i18n/context";
import { fmt as interp } from "@/lib/i18n/format";

const RECENT_KEY = ["owner", "checkin", "recent"];
const RECENT_PER_PAGE = 8;

/**
 * Turning a staff phone into the venue's scanner.
 *
 * Not a sidebar entry: installing it happens once, and a menu is for what you
 * press every day. It lives here because this is the screen someone is looking
 * at when they discover the venue has no scanner — and the QR matters, because
 * the setup has to happen on a DIFFERENT device from the one reading these
 * instructions. Typing a LAN address into a phone keyboard is where this
 * otherwise falls apart.
 */
function InstallOnPhone() {
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);
  const t = useMessages("owner").checkin;

  useEffect(() => {
    const target = `${window.location.origin}/scan`;
    setUrl(target);
    void QRCode.toDataURL(target, { margin: 1, width: 320 }).then(setQr).catch(() => setQr(null));
  }, []);

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 font-semibold">
          <Smartphone className="size-4 text-brand" /> {t.installBadge}
        </span>
        <span className="text-xs text-muted-foreground">{open ? t.hide : t.setupOnce}</span>
      </button>

      {open && (
        <div className="border-t border-black/5 p-4">
          <p className="text-sm text-muted-foreground">
            {t.installPre}
            <b>{t.installBold}</b>
            {t.installPost}
          </p>
          {qr && (
            /* eslint-disable-next-line @next/next/no-img-element -- a data: URI generated in the browser */
            <img src={qr} alt={interp(t.qrAlt, { url })} className="mx-auto mt-3 size-44 rounded-xl" />
          )}
          <code className="mt-2 block break-all text-center text-xs text-muted-foreground">{url}</code>
          <p className="mt-3 rounded-lg bg-app p-2 text-xs text-muted-foreground">
            {t.httpsNote}
          </p>
        </div>
      )}
    </section>
  );
}

function thaiTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "—";
}

/**
 * The counter's scanner — all of it, in one place.
 *
 * Staff used to have to know which menu to open before they knew what the
 * customer was holding: a booking QR meant this screen, a reward code meant
 * Points. Now everything scannable lands here and the server decides what it
 * is, so the desk just scans.
 *
 * Two ways in, because a camera is not always an option: point it at the QR, or
 * type the code off their screen. Both go through the same endpoint, so both
 * get the same answers.
 */
export default function OwnerScanPage() {
  const qc = useQueryClient();
  const t = useMessages("owner").checkin;
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manual, setManual] = useState("");

  const { data: settings } = useQuery({ queryKey: ["owner", "settings"], queryFn: ownerApi.getSettings });
  const { data: recent } = useQuery({ queryKey: RECENT_KEY, queryFn: ownerApi.getRecentCheckins });

  // Page the recent-check-ins list, but fit as many rows as the card is tall so
  // it fills the column — only the overflow spills onto the next page.
  const [recentPage, setRecentPage] = useState(1);
  const [recentPerPage, setRecentPerPage] = useState(RECENT_PER_PAGE);
  const recentListRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const ul = recentListRef.current;
    if (!ul) return;
    const ro = new ResizeObserver(() => {
      const row = ul.querySelector("li");
      const rowH = row?.getBoundingClientRect().height || 64;
      const fit = Math.max(1, Math.floor(ul.clientHeight / rowH));
      setRecentPerPage((p) => (p === fit ? p : fit));
    });
    ro.observe(ul);
    return () => ro.disconnect();
  }, [recent]);
  const recentPageCount = Math.max(1, Math.ceil((recent?.length ?? 0) / recentPerPage));
  const recentSafePage = Math.min(recentPage, recentPageCount);
  const recentPaged = (recent ?? []).slice((recentSafePage - 1) * recentPerPage, recentSafePage * recentPerPage);

  const submit = useMutation({
    mutationFn: (code: string) => ownerApi.scan(code),
    onSuccess: (res) => {
      setResult(res);
      setManual("");
      qc.invalidateQueries({ queryKey: RECENT_KEY });
      // A handed-over reward changes the points queue, which is a different
      // screen — invalidate it so it is not stale when someone opens it.
      if (res.kind === "reward") qc.invalidateQueries({ queryKey: ["owner", "rewards", "redemptions"] });
    },
    // A code this venue does not know, or a role that may not do this: both come
    // back as errors, and both are things to say out loud rather than throw away.
    onError: (e) => {
      setResult({ kind: "unknown", ok: false, code: "error", message: (e as Error).message });
    },
  });

  // One scan per code: the camera reads the same QR ~30 times a second, and
  // firing a request for each would hammer the API and flicker the result.
  const lastScanned = useRef<string | null>(null);
  const onScan = useCallback(
    (token: string) => {
      if (token === lastScanned.current || submit.isPending) return;
      lastScanned.current = token;
      submit.mutate(token);
      // Let the same customer be re-scanned after a moment, deliberately.
      setTimeout(() => (lastScanned.current = null), 4000);
    },
    [submit],
  );

  const enabled = settings?.checkinEnabled !== false;

  // The switch lives here as well as in ตั้งค่า: this is the screen someone is
  // looking at when they decide the venue does or does not scan.
  const toggle = useMutation({
    mutationFn: (next: boolean) => ownerApi.updateSettings({ checkinEnabled: next }),
    onSuccess: (updated) => qc.setQueryData(["owner", "settings"], updated),
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        {settings && (
          <div className="text-right">
            <button
              type="button"
              onClick={() => toggle.mutate(!enabled)}
              disabled={toggle.isPending}
              aria-pressed={enabled}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                enabled ? "bg-brand/10 text-brand" : "bg-app text-muted-foreground"
              }`}
            >
              <Power className="size-4" />
              {toggle.isPending ? t.saving : enabled ? t.systemOn : t.systemOff}
            </button>
            {toggle.isError && (
              <p className="mt-1 text-xs text-brand-danger">
                {t.noPerm}
              </p>
            )}
          </div>
        )}
      </header>

      {!enabled && (
        <p className="rounded-2xl bg-brand-accent/15 p-4 text-sm">
          {t.offBannerPre}
          <strong>{t.offBannerBold}</strong>
          {t.offBannerPost}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <QrScanner onScan={onScan} />

          <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <Label htmlFor="manual-code" className="flex items-center gap-1.5">
              <Keyboard className="size-4" /> {t.typeCode}
            </Label>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (manual.trim()) submit.mutate(manual.trim());
              }}
            >
              <Input
                id="manual-code"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder={t.codePlaceholder}
                autoComplete="off"
                className="font-mono"
              />
              <Button type="submit" disabled={!manual.trim() || submit.isPending}>
                {submit.isPending ? "..." : t.check}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">{t.manualHint}</p>
          </section>

          <InstallOnPhone />
        </div>

        <div className="flex flex-col gap-4">
          <ResultCard result={result} />

          {/* Fills the rest of the column so it ends level with the scanner on
              the left; the list scrolls and the pager stays pinned at the foot. */}
          <section className="flex flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            <h2 className="shrink-0 border-b border-black/5 px-4 py-3 font-semibold">{t.recentTitle}</h2>
            {!recent || recent.length === 0 ? (
              <p className="grid flex-1 place-items-center p-6 text-center text-sm text-muted-foreground">{t.recentEmpty}</p>
            ) : (
              <div className="flex flex-1 flex-col">
                <ul ref={recentListRef} className="flex-1 divide-y divide-black/5 overflow-y-auto">
                  {recentPaged.map((b) => (
                    <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                        <CheckCircle2 className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium"><CustomerName id={b.customerId} name={b.customerName} fallback={t.dash} /></div>
                        <div className="truncate text-xs text-muted-foreground">
                          {b.courtName ?? t.dash} · {b.start}–{b.end}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{thaiTime(b.checkedInAt)}</span>
                    </li>
                  ))}
                </ul>
                {recentPageCount > 1 && (
                  <div className="flex shrink-0 items-center justify-between gap-2 border-t border-black/5 px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setRecentPage(recentSafePage - 1)}
                      disabled={recentSafePage <= 1}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-black/10 transition hover:bg-app disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      {t.prev}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {interp(t.pageN, { page: recentSafePage, total: recentPageCount })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRecentPage(recentSafePage + 1)}
                      disabled={recentSafePage >= recentPageCount}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-black/10 transition hover:bg-app disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      {t.next}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * The answer to the last scan, in the language the desk needs it.
 *
 * Says WHAT it was as well as whether it worked: "เช็คอินสำเร็จ" and "จ่ายของ
 * รางวัลแล้ว" are not interchangeable when someone is standing there waiting.
 */
function ResultCard({ result }: { result: ScanResult | null }) {
  const t = useMessages("owner").checkin;
  if (!result) {
    return (
      <section className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-black/15 p-6 text-center text-sm text-muted-foreground">
        {t.resultPlaceholder}
      </section>
    );
  }

  const good = result.ok;
  const KIND_LABEL: Record<string, string> = t.kind;

  return (
    <section
      className={`rounded-2xl p-5 shadow-sm ring-1 ${
        good ? "bg-brand/5 ring-brand/20" : "bg-brand-danger/5 ring-brand-danger/20"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`shrink-0 ${good ? "text-brand" : "text-brand-danger"}`}>
          {good ? <CheckCircle2 className="size-7" /> : <XCircle className="size-7" />}
        </span>
        <div className="min-w-0">
          <span className="mb-1 inline-block rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {KIND_LABEL[result.kind] ?? result.kind}
          </span>
          <p className={`font-semibold ${good ? "text-brand" : "text-brand-danger"}`}>{result.message}</p>

          {result.booking && (
            <div className="mt-2 space-y-0.5 text-sm">
              <div className="font-semibold"><CustomerName id={result.booking.customerId} name={result.booking.customerName} fallback={t.dash} /></div>
              <div className="text-muted-foreground">
                {result.booking.courtName ?? t.dash} · {result.booking.date} · {result.booking.start}–
                {result.booking.end}
              </div>
              <div className="font-mono text-xs text-muted-foreground">{result.booking.code}</div>
            </div>
          )}

          {result.reward && (
            <div className="mt-2 space-y-0.5 text-sm">
              <div className="font-semibold">{result.reward.name}</div>
              <div className="text-muted-foreground">
                <CustomerName id={result.reward.customerId} name={result.reward.customerName} fallback={t.dash} /> · {interp(t.pointsUsed, { points: result.reward.pointsSpent.toLocaleString() })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
