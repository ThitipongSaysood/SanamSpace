"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, Hourglass, QrCode, Receipt, Upload } from "lucide-react";
import { ownerApi } from "@/lib/api/owner";
import { validateSlip } from "@/lib/booking/slip";
import { PromptPayQR } from "@/components/promptpay-qr";
import { Loading, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { BillingDocument, OpenPdfButton } from "@/components/billing-document";
import type { AdminInvoice, AdminSubscription } from "@/lib/types";

const fmt = new Intl.NumberFormat("th-TH");
const PERIODS = [
  { months: 1, label: "1 เดือน" },
  { months: 3, label: "3 เดือน" },
  { months: 6, label: "6 เดือน" },
  { months: 12, label: "1 ปี" },
];

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS: Record<string, { label: string; cls: string }> = {
  unpaid: { label: "รอชำระ", cls: "bg-amber-100 text-amber-700" },
  overdue: { label: "เกินกำหนด", cls: "bg-red-100 text-red-700" },
  pending_review: { label: "รอตรวจสอบ", cls: "bg-blue-100 text-blue-700" },
  paid: { label: "ชำระแล้ว", cls: "bg-brand/10 text-brand" },
  rejected: { label: "ไม่ผ่าน", cls: "bg-red-100 text-red-700" },
};

function StatusChip({ status }: { status: string }) {
  const m = STATUS[status] ?? { label: status, cls: "bg-slate-100 text-slate-600" };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

/**
 * What this venue has used against what its plan allows.
 *
 * Here rather than buried in settings because this is the page where the answer
 * to "we are full" is one scroll away. A venue should meet its ceiling on a bar
 * long before it meets it as a refusal on the afternoon it needs another court.
 *
 * The monthly booking row is marked because it behaves differently: it is
 * counted and shown, never enforced. Blocking a booking would take the venue's
 * revenue to settle the platform's bill, against a customer who has no idea a
 * plan exists.
 */
function PlanUsage({ limits }: { limits?: AdminSubscription["limits"] }) {
  const rows = Object.entries(limits ?? {}).filter(([, v]) => v.limit != null);

  if (rows.length === 0) return null;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <h2 className="text-sm font-semibold">การใช้งานตามแพ็กเกจ</h2>
      <div className="mt-3 space-y-3">
        {rows.map(([key, row]) => {
          const pct = Math.min(100, Math.round((row.used / (row.limit || 1)) * 100));
          const full = row.used >= (row.limit ?? Infinity);
          return (
            <div key={key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">
                  {row.label}
                  {!row.enforced && <span className="ml-1 text-xs">(นับไว้ดู ไม่ได้ปิดกั้น)</span>}
                </span>
                <span className={`font-medium ${full && row.enforced ? "text-rose-600" : ""}`}>
                  {fmt.format(row.used)} / {fmt.format(row.limit ?? 0)}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-app">
                <div
                  className={`h-2 rounded-full ${pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-400" : "bg-brand"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {full && row.enforced && (
                <p className="mt-1 text-xs text-rose-600">ใช้ครบแล้ว — เพิ่มอีกไม่ได้จนกว่าจะอัปเกรดแพ็กเกจ</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function OwnerBillingPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "billing"],
    queryFn: ownerApi.getBilling,
  });
  const invoicesQ = useQuery({ queryKey: ["owner", "billing", "invoices"], queryFn: ownerApi.getBillingInvoices });

  const [months, setMonths] = useState(1);
  const [payOpen, setPayOpen] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);

  const renew = useMutation({
    mutationFn: () => ownerApi.renewSubscription(months),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner", "billing"] });
      qc.invalidateQueries({ queryKey: ["owner", "subscription"] });
      // Straight to the QR — the point of renewing is to pay right now.
      setPayOpen(true);
    },
    onError: (e: Error) => window.alert(e.message),
  });

  const invoice = data?.outstandingInvoice ?? null;

  // An invoice already waiting when the page loads (raised earlier, or billed by
  // the platform) opens the payment dialog on arrival — same as after renewing.
  const seen = useRef(false);
  useEffect(() => {
    if (invoice && !seen.current) {
      seen.current = true;
      setPayOpen(true);
    }
  }, [invoice]);

  if (isLoading) return <Loading rows={3} />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  const sub = data.subscription;
  const days = sub?.daysRemaining ?? null;
  // Warn from a week out — enough time to transfer and have it approved.
  const expiringSoon = days !== null && days >= 0 && days <= 7;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">แพ็กเกจและการต่ออายุ</h1>
        <p className="text-sm text-muted-foreground">ดูวันหมดอายุ ต่ออายุ และแจ้งโอนเงิน</p>
      </header>

      {/* --- Current plan --- */}
      <section
        className={`rounded-2xl p-5 shadow-sm ring-1 ${
          sub?.isExpired
            ? "bg-red-50 ring-red-200"
            : expiringSoon
              ? "bg-amber-50 ring-amber-200"
              : "bg-white ring-black/5"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="size-4 text-brand" /> แพ็กเกจปัจจุบัน
            </div>
            <div className="mt-2 text-2xl font-bold">{sub?.planName ?? "—"}</div>
            {sub?.price != null && (
              <div className="text-sm text-muted-foreground">
                ฿{fmt.format(sub.price)} / {sub.interval === "year" ? "ปี" : "เดือน"}
              </div>
            )}
          </div>

          <div className="text-right">
            <div className="text-xs text-muted-foreground">หมดอายุ</div>
            <div className="text-lg font-semibold">{fmtDate(sub?.endsAt)}</div>
            {days !== null && (
              <div
                className={`mt-1 text-sm font-semibold ${
                  sub?.isExpired ? "text-red-600" : expiringSoon ? "text-amber-700" : "text-muted-foreground"
                }`}
              >
                {sub?.isExpired ? `หมดอายุแล้ว ${Math.abs(days)} วัน` : `เหลืออีก ${days} วัน`}
              </div>
            )}
          </div>
        </div>

        {sub?.isExpired && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-white/70 p-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              แพ็กเกจหมดอายุแล้ว ระบบจัดการสนามถูกล็อกไว้ชั่วคราว —{" "}
              <b>หน้าจองของลูกค้ายังใช้งานได้ตามปกติ</b> ต่ออายุด้านล่างเพื่อกลับมาใช้งาน
            </span>
          </p>
        )}
      </section>

      <PlanUsage limits={sub?.limits} />

      {/* --- Renew / pay --- */}
      {invoice ? (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">ใบแจ้งหนี้ {invoice.number}</h2>
                <StatusChip status={invoice.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {invoice.periodMonths ?? 1} เดือน · ครบกำหนด {invoice.dueDate}
                {invoice.source === "admin" ? " · ออกโดยผู้ดูแลระบบ" : ""}
              </p>
              <div className="mt-2 text-2xl font-bold text-brand">฿{fmt.format(invoice.amount)}</div>
            </div>
            <Button className="h-11 gap-2 rounded-xl px-6" onClick={() => setPayOpen(true)}>
              <QrCode className="size-4" />
              {invoice.status === "pending_review" ? "ดูสถานะ" : "ชำระเงิน"}
            </Button>
          </div>
        </section>
      ) : (
        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-sm font-semibold">ต่ออายุ</h2>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.months}
                type="button"
                onClick={() => setMonths(p.months)}
                aria-pressed={months === p.months}
                className={`h-10 rounded-xl px-4 text-sm font-semibold transition ${
                  months === p.months
                    ? "bg-brand text-brand-foreground"
                    : "bg-app text-foreground ring-1 ring-black/10 hover:ring-brand/40"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {sub?.price != null && (
            <p className="text-sm text-muted-foreground">
              ยอดที่ต้องชำระ <b className="text-foreground">฿{fmt.format(sub.price * months)}</b>
            </p>
          )}
          <Button onClick={() => renew.mutate()} disabled={renew.isPending} className="h-11 rounded-xl px-6">
            {renew.isPending ? "กำลังสร้างใบแจ้งหนี้..." : "ต่ออายุ"}
          </Button>
        </section>
      )}

      {/* --- History --- */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-3 text-sm font-semibold">ประวัติการชำระเงิน</h2>
        {(invoicesQ.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีรายการ</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[520px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">เลขที่</th>
                  <th className="pb-2 font-medium">ระยะเวลา</th>
                  <th className="pb-2 font-medium">ยอด</th>
                  <th className="pb-2 font-medium">วันที่ออก</th>
                  <th className="pb-2 font-medium">สถานะ</th>
                  <th className="pb-2 text-right font-medium">เอกสาร</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {(invoicesQ.data ?? []).map((inv) => (
                  <tr key={inv.id}>
                    <td data-label="เลขที่" className="py-2.5 font-mono text-xs">{inv.number}</td>
                    <td data-label="ระยะเวลา" className="py-2.5">{inv.periodMonths ?? 1} เดือน</td>
                    <td data-label="ยอด" className="py-2.5 tabular-nums">฿{fmt.format(inv.amount)}</td>
                    <td data-label="วันที่ออก" className="py-2.5 text-muted-foreground">{inv.issueDate}</td>
                    <td data-label="สถานะ" className="py-2.5"><StatusChip status={inv.status} /></td>
                    <td data-label="เอกสาร" className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setDocId(inv.id)}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand ring-1 ring-brand/20 transition hover:bg-brand/10"
                      >
                        {inv.status === "paid" ? (
                          <><Receipt className="size-3.5" /> ใบเสร็จ</>
                        ) : (
                          <><FileText className="size-3.5" /> ใบแจ้งหนี้</>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {payOpen && invoice && <PayDialog invoice={invoice} payTo={data.payTo} onClose={() => setPayOpen(false)} />}
      {docId && <DocumentDialog invoiceId={docId} onClose={() => setDocId(null)} />}
    </div>
  );
}

/**
 * The venue's own copy of a document — ใบแจ้งหนี้ before payment, ใบเสร็จรับเงิน
 * after. Fetched from the server rather than built here, so it is byte-for-byte
 * what the platform issued.
 */
function DocumentDialog({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "billing", "document", invoiceId],
    queryFn: () => ownerApi.getBillingDocument(invoiceId),
  });

  return (
    <Modal
      title={data?.title ?? "เอกสาร"}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            ปิด
          </Button>
          {data && (
            <OpenPdfButton kind={data.kind} onFetch={() => ownerApi.getBillingDocumentPdf(invoiceId)} />
          )}
        </>
      }
    >
      {isLoading && <Loading rows={3} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && <BillingDocument doc={data} />}
    </Modal>
  );
}

/**
 * The pay-now dialog: a scannable QR, the bank fallback, and the slip upload.
 *
 * A dialog rather than an inline panel so the QR is the whole screen on a phone
 * — the venue reaches for a banking app the moment it opens, and nothing else
 * on the page competes for that moment.
 */
function PayDialog({
  invoice,
  payTo,
  onClose,
}: {
  invoice: AdminInvoice;
  payTo: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: how } = useQuery({
    queryKey: ["owner", "billing", "instructions", invoice.id],
    queryFn: () => ownerApi.getBillingInstructions(invoice.id),
  });

  const upload = useMutation({
    mutationFn: () => ownerApi.uploadBillingSlip(invoice.id, file!),
    onSuccess: () => {
      setFile(null);
      qc.invalidateQueries({ queryKey: ["owner", "billing"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  function pick(f: File | null) {
    const result = validateSlip(f);
    setError(result.ok ? null : result.error);
    setFile(result.ok ? f : null);
  }

  const waiting = invoice.status === "pending_review";

  return (
    <Modal
      title={waiting ? "สถานะการชำระเงิน" : "ชำระเงินเพื่อต่ออายุ"}
      onClose={onClose}
      width="max-w-lg"
      footer={
        waiting ? (
          <Button type="button" variant="outline" onClick={onClose}>
            ปิด
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onClose}>
              ปิด
            </Button>
            <Button type="button" disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
              {upload.isPending ? "กำลังส่ง..." : "ส่งสลิป"}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">ใบแจ้งหนี้ {invoice.number}</div>
            <div className="text-sm text-muted-foreground">ต่ออายุ {invoice.periodMonths ?? 1} เดือน</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">ยอดที่ต้องชำระ</div>
            <div className="text-2xl font-bold text-brand">฿{fmt.format(invoice.amount)}</div>
          </div>
        </div>

        {invoice.rejectReason && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
            สลิปก่อนหน้าไม่ผ่าน: {invoice.rejectReason} — กรุณาโอนใหม่และแนบสลิปอีกครั้ง
          </p>
        )}

        {waiting ? (
          <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
            <Hourglass className="mt-0.5 size-5 shrink-0" />
            <div>
              <div className="font-semibold">ส่งสลิปแล้ว รอผู้ดูแลระบบตรวจสอบ</div>
              <p className="mt-0.5">ระบบจะต่ออายุให้อัตโนมัติเมื่อตรวจสอบเรียบร้อย</p>
            </div>
          </div>
        ) : (
          <>
            {how?.promptpay ? (
              <div className="rounded-xl bg-app p-4 text-center">
                <div className="text-sm font-semibold">สแกนจ่ายด้วย PromptPay</div>
                <div className="mt-3 flex justify-center">
                  <PromptPayQR payload={how.promptpay.payload} size={220} />
                </div>
                {payTo && <div className="mt-2 text-xs text-muted-foreground">{payTo}</div>}
                <p className="mt-1 text-xs text-muted-foreground">ยอดถูกใส่ใน QR แล้ว ไม่ต้องกรอกเอง</p>
              </div>
            ) : (
              <p className="rounded-xl bg-app p-4 text-sm text-muted-foreground">
                ผู้ดูแลระบบยังไม่ได้ตั้งค่า PromptPay — กรุณาโอนผ่านบัญชีธนาคารด้านล่าง
              </p>
            )}

            <div className="rounded-xl bg-app p-4">
              <div className="text-sm font-semibold">หรือโอนผ่านบัญชีธนาคาร</div>
              {how?.bank ? (
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">ธนาคาร</dt>
                    <dd className="font-medium">{how.bank.bankName}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">ชื่อบัญชี</dt>
                    <dd className="font-medium">{how.bank.accountName}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">เลขบัญชี</dt>
                    <dd className="font-mono font-medium">{how.bank.accountNumber}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">ยังไม่ได้ตั้งค่าบัญชีรับเงิน</p>
              )}
            </div>

            {/* Slip upload — the venue transfers, then proves it here. */}
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0] ?? null)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 gap-2 rounded-xl"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="size-4" /> {file ? "เปลี่ยนสลิป" : "แนบสลิปโอนเงิน"}
                </Button>
                {file && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-brand">
                    <CheckCircle2 className="size-4" /> {file.name}
                  </span>
                )}
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
