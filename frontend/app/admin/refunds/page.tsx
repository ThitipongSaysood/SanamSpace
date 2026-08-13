"use client";
import { toast } from "@/lib/toast";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import type { AdminRefund } from "@/lib/types";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useMessages, useLocale } from "@/lib/i18n/context";
import { intlLocale } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";

const fmt = new Intl.NumberFormat("th-TH");
const REFUNDS_KEY = ["admin", "refunds"];

function StatusPill({ status }: { status: string }) {
  const t = useMessages("admin").refunds;
  const cls =
    status === "approved"
      ? "bg-emerald-100 text-emerald-700"
      : status === "requested"
        ? "bg-amber-100 text-amber-700"
        : status === "rejected"
          ? "bg-rose-100 text-rose-700"
          : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {(t.status as Record<string, string>)[status] ?? status}
    </span>
  );
}

function fmtDate(iso: string | null | undefined, locale: Locale) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString(intlLocale(locale))} ${d.toLocaleTimeString(intlLocale(locale), { hour: "2-digit", minute: "2-digit" })}`;
}

export default function AdminRefundsPage() {
  const t = useMessages("admin").refunds;
  const { locale } = useLocale();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: REFUNDS_KEY,
    queryFn: superAdminApi.getRefunds,
  });

  const [sel, setSel] = useState<AdminRefund | null>(null);
  const [method, setMethod] = useState<"wallet" | "manual">("wallet");
  const [note, setNote] = useState("");

  // Reset the form whenever a different refund is opened.
  useEffect(() => {
    setMethod("wallet");
    setNote("");
  }, [sel?.id]);

  const approveM = useMutation({
    mutationFn: () => superAdminApi.approveRefund(sel!.id, method, note.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: REFUNDS_KEY });
      setSel(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectM = useMutation({
    mutationFn: () => superAdminApi.rejectRefund(sel!.id, note.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: REFUNDS_KEY });
      setSel(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = approveM.isPending || rejectM.isPending;
  const pending = sel?.status === "requested";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t.subtitle}
        </p>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message={t.empty} />}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[760px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t.colDate}</th>
                  <th className="px-4 py-3">{t.colOrg}</th>
                  <th className="px-4 py-3">{t.colCustomer}</th>
                  <th className="px-4 py-3">{t.colBooking}</th>
                  <th className="px-4 py-3">{t.colReason}</th>
                  <th className="px-4 py-3 text-right">{t.colAmount}</th>
                  <th className="px-4 py-3">{t.colStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.map((r) => (
                  <tr key={r.id} onClick={() => setSel(r)} className="cursor-pointer hover:bg-app/60">
                    <td data-label={t.colDate} className="px-4 py-3 text-muted-foreground">{fmtDate(r.createdAt, locale)}</td>
                    <td data-label={t.colOrg} className="px-4 py-3 font-medium">{r.organizationName ?? t.dash}</td>
                    <td data-label={t.colCustomer} className="px-4 py-3 text-muted-foreground">{r.customerName ?? t.dash}</td>
                    <td data-label={t.colBooking} className="px-4 py-3 text-muted-foreground">{r.bookingCode ?? t.dash}</td>
                    <td data-label={t.colReason} className="px-4 py-3 text-muted-foreground">{r.reason ?? t.dash}</td>
                    <td data-label={t.colAmount} className="px-4 py-3 text-right font-semibold text-brand">฿{fmt.format(r.amount)}</td>
                    <td data-label={t.colStatus} className="px-4 py-3">
                      <StatusPill status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sel && (
        <Modal
          title={t.detailTitle}
          onClose={() => setSel(null)}
          footer={
            pending ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => rejectM.mutate()}
                  disabled={busy}
                >
                  <XCircle className="size-4" /> {rejectM.isPending ? t.saving : t.reject}
                </Button>
                <Button type="button" onClick={() => approveM.mutate()} disabled={busy}>
                  <CheckCircle2 className="size-4" /> {approveM.isPending ? t.saving : t.approve}
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => setSel(null)}>
                {t.close}
              </Button>
            )
          }
        >
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{t.colOrg}</span><span className="font-medium">{sel.organizationName ?? t.dash}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t.colCustomer}</span><span className="font-medium">{sel.customerName ?? t.dash}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t.colBooking}</span><span className="font-medium">{sel.bookingCode ?? t.dash}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t.colReason}</span><span className="font-medium">{sel.reason ?? t.dash}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t.rowRequestedBy}</span><span className="font-medium">{sel.requestedBy}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t.colStatus}</span><StatusPill status={sel.status} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t.rowRequestedAt}</span><span className="font-medium">{fmtDate(sel.createdAt, locale)}</span></div>
            {sel.processedAt && (
              <div className="flex justify-between"><span className="text-muted-foreground">{t.rowProcessedAt}</span><span className="font-medium">{fmtDate(sel.processedAt, locale)}</span></div>
            )}
            {sel.method && !pending && (
              <div className="flex justify-between"><span className="text-muted-foreground">{t.rowMethod}</span><span className="font-medium">{(t.method as Record<string, string>)[sel.method] ?? sel.method}</span></div>
            )}
            {sel.note && (
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">{t.rowNote}</span><span className="font-medium text-right">{sel.note}</span></div>
            )}
            <div className="flex items-center justify-between border-t border-black/5 pt-3 text-base">
              <span className="text-muted-foreground">{t.rowAmount}</span>
              <span className="font-bold text-brand">฿{fmt.format(sel.amount)}</span>
            </div>

            {pending && (
              <div className="space-y-3 border-t border-black/5 pt-3">
                <div>
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{t.methodTitle}</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(["wallet", "manual"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMethod(m)}
                        aria-pressed={method === m}
                        className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                          method === m
                            ? "border-brand bg-brand/10 text-brand"
                            : "border-black/10 text-foreground hover:bg-app"
                        }`}
                      >
                        {(t.method as Record<string, string>)[m]}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {method === "wallet"
                      ? t.walletNote
                      : t.manualNote}
                  </p>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{t.noteLabel}</span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder={t.notePlaceholder}
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </label>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
