"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Keyboard, LogOut, XCircle } from "lucide-react";
import type { ScanResult } from "@/lib/types";
import { getOwnerToken, ownerApi } from "@/lib/api/owner";
import { QrScanner } from "@/components/qr-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * The scanner as its own app, for a venue whose "scanner" is a staff phone.
 *
 * `/owner/checkin` does the same job, but it lives inside the owner portal —
 * a sidebar, a plan badge and a support card wrapped around a camera, on a
 * screen held one-handed at a counter between two customers. This route sits
 * OUTSIDE that layout on purpose: full-bleed camera, one result, nothing else
 * to press by accident.
 *
 * It is installable (see app/manifest.ts) so it opens from the home screen with
 * no browser chrome and no address bar to mistype.
 *
 * The same POST /owner/scan endpoint answers here, so the permission rules are
 * identical — a staff member who may check in but not hand over rewards gets
 * exactly the same refusals as they would in the portal. This is a different
 * doorway, not a different set of keys.
 */
export default function ScanApp() {
  const router = useRouter();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [typing, setTyping] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  // No owner layout above this route, so the guard lives here. Same token, same
  // login screen — a scanner that lets an unauthenticated phone through would
  // be a way into the venue's data, not a convenience.
  useEffect(() => {
    if (getOwnerToken()) {
      setAuthed(true);
    } else {
      setAuthed(false);
      router.replace("/owner/login");
    }
  }, [router]);

  // Where the camera cannot be offered at all — an http origin, which is every
  // phone on the office Wi-Fi until this is served over https — open the code
  // box straight away. Otherwise the one thing that still works is hidden
  // behind a button, under an error explaining why the other thing does not.
  useEffect(() => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) setTyping(true);
  }, []);

  const send = useCallback(async (code: string) => {
    setBusy(true);
    try {
      setResult(await ownerApi.scan(code));
    } catch (e) {
      setResult({ kind: "unknown", ok: false, code, message: (e as Error).message });
    } finally {
      setBusy(false);
      // A counter scans one customer after another; holding the last answer on
      // screen forever is how the second person gets waved through on the
      // first person's result.
      setTimeout(() => setResult(null), 6000);
    }
  }, []);

  if (authed !== true) return null;

  return (
    <main className="flex min-h-dvh flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-base font-semibold">สแกน QR</h1>
          <p className="text-xs text-white/60">เช็คอิน · รับของรางวัล</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/owner")}
          className="rounded-lg p-2 text-white/70 hover:bg-white/10"
          aria-label="กลับไประบบจัดการสนาม"
        >
          <LogOut className="size-5" />
        </button>
      </header>

      <div className="px-4">
        <QrScanner onScan={send} idleHint="แตะเปิดกล้อง แล้วส่องไปที่ QR ของลูกค้า" />
      </div>

      {/* The answer, big enough to read at arm's length across a counter. */}
      <div className="mt-4 flex-1 px-4 pb-6">
        {busy && <p className="text-center text-sm text-white/60">กำลังตรวจสอบ…</p>}

        {result && (
          <div
            role="status"
            className={`rounded-2xl p-4 ${result.ok ? "bg-emerald-500/15 ring-1 ring-emerald-400/40" : "bg-rose-500/15 ring-1 ring-rose-400/40"}`}
          >
            <div className="flex items-start gap-3">
              {result.ok ? (
                <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="mt-0.5 size-6 shrink-0 text-rose-400" />
              )}
              <div className="min-w-0">
                <p className="text-lg font-semibold">{result.message}</p>
                {result.booking && (
                  <p className="mt-1 text-sm text-white/70">
                    {result.booking.customerName ?? "—"} · {result.booking.courtName} ·{" "}
                    {result.booking.start}–{result.booking.end}
                  </p>
                )}
                {result.reward && (
                  <p className="mt-1 text-sm text-white/70">
                    {result.reward.name} · {result.reward.customerName ?? "—"}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* A camera is not always an option: a cracked lens, a code on a
            screen too dim to read. Typing the code hits the same endpoint. */}
        {typing ? (
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (manual.trim()) {
                void send(manual.trim());
                setManual("");
              }
            }}
          >
            <Input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="พิมพ์รหัสจากหน้าจอลูกค้า"
              className="border-white/20 bg-white/10 text-white placeholder:text-white/40"
              autoFocus
            />
            <Button type="submit" disabled={!manual.trim() || busy}>
              ตรวจ
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setTyping(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 py-3 text-sm text-white/70 hover:bg-white/5"
          >
            <Keyboard className="size-4" /> พิมพ์รหัสแทนการสแกน
          </button>
        )}
      </div>
    </main>
  );
}
