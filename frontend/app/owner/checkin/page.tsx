"use client";
import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Keyboard, Power, XCircle } from "lucide-react";
import type { ScanResult } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { CustomerName } from "@/components/customer-peek";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrScanner } from "@/components/qr-scanner";

const RECENT_KEY = ["owner", "checkin", "recent"];

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
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manual, setManual] = useState("");

  const { data: settings } = useQuery({ queryKey: ["owner", "settings"], queryFn: ownerApi.getSettings });
  const { data: recent } = useQuery({ queryKey: RECENT_KEY, queryFn: ownerApi.getRecentCheckins });

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
          <h1 className="text-2xl font-bold tracking-tight">สแกน</h1>
          <p className="text-sm text-muted-foreground">
            สแกนได้ทุกอย่างที่นี่ · QR เช็คอิน และ รหัสรับของรางวัล — ระบบแยกให้เอง
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
              {toggle.isPending ? "กำลังบันทึก..." : enabled ? "ระบบเช็คอิน: เปิด" : "ระบบเช็คอิน: ปิด"}
            </button>
            {toggle.isError && (
              <p className="mt-1 text-xs text-brand-danger">
                เปลี่ยนไม่ได้ — ต้องมีสิทธิ์ “ตั้งค่า”
              </p>
            )}
          </div>
        )}
      </header>

      {!enabled && (
        <p className="rounded-2xl bg-brand-accent/15 p-4 text-sm">
          ระบบเช็คอิน<strong>ปิดอยู่</strong> — ลูกค้าจะไม่เห็นหน้า QR ในแอป
          แต่พนักงานยังสแกนหรือพิมพ์รหัสที่หน้านี้ได้ตามปกติ
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <QrScanner onScan={onScan} />

          <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <Label htmlFor="manual-code" className="flex items-center gap-1.5">
              <Keyboard className="size-4" /> พิมพ์รหัส
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
                placeholder="เช่น BK260614MKNPUC หรือ R7K2M9"
                autoComplete="off"
                className="font-mono"
              />
              <Button type="submit" disabled={!manual.trim() || submit.isPending}>
                {submit.isPending ? "..." : "ตรวจสอบ"}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">ใช้เมื่อกล้องใช้ไม่ได้ หรือลูกค้าเปิดแอปไม่ได้</p>
          </section>
        </div>

        <div className="space-y-4">
          <ResultCard result={result} />

          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            <h2 className="border-b border-black/5 px-4 py-3 font-semibold">เช็คอินล่าสุด</h2>
            {!recent || recent.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">ยังไม่มีใครเช็คอินวันนี้</p>
            ) : (
              <ul className="divide-y divide-black/5">
                {recent.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                      <CheckCircle2 className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium"><CustomerName id={b.customerId} name={b.customerName} fallback="—" /></div>
                      <div className="truncate text-xs text-muted-foreground">
                        {b.courtName ?? "—"} · {b.start}–{b.end}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{thaiTime(b.checkedInAt)}</span>
                  </li>
                ))}
              </ul>
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
  if (!result) {
    return (
      <section className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-black/15 p-6 text-center text-sm text-muted-foreground">
        ผลการสแกนจะแสดงที่นี่
      </section>
    );
  }

  const good = result.ok;
  const KIND_LABEL: Record<string, string> = { checkin: "เช็คอิน", reward: "ของรางวัล", unknown: "ไม่รู้จัก" };

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
              <div className="font-semibold"><CustomerName id={result.booking.customerId} name={result.booking.customerName} fallback="—" /></div>
              <div className="text-muted-foreground">
                {result.booking.courtName ?? "—"} · {result.booking.date} · {result.booking.start}–
                {result.booking.end}
              </div>
              <div className="font-mono text-xs text-muted-foreground">{result.booking.code}</div>
            </div>
          )}

          {result.reward && (
            <div className="mt-2 space-y-0.5 text-sm">
              <div className="font-semibold">{result.reward.name}</div>
              <div className="text-muted-foreground">
                <CustomerName id={result.reward.customerId} name={result.reward.customerName} fallback="—" /> · ใช้ {result.reward.pointsSpent.toLocaleString()} คะแนน
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
