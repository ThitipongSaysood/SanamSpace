"use client";
import { toast } from "@/lib/toast";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, CheckCircle2, XCircle } from "lucide-react";
import type { AdminInvoice } from "@/lib/types";
import { superAdminApi } from "@/lib/api/superadmin";
import { appendPage } from "@/lib/api/paged";
import { LoadMore } from "@/components/load-more";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { BillingDocument, OpenPdfButton } from "@/components/billing-document";
import { useMessages } from "@/lib/i18n/context";
import { fmt as interp } from "@/lib/i18n/format";

const fmt = new Intl.NumberFormat("th-TH");
const INVOICES_KEY = ["admin", "invoices"];

const isPaid = (inv: AdminInvoice) => inv.status === "paid";

const PILL_CLS: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-rose-100 text-rose-700",
  rejected: "bg-rose-100 text-rose-700",
  pending_review: "bg-blue-100 text-blue-700",
  unpaid: "bg-amber-100 text-amber-700",
};

function StatusPill({ status }: { status: string }) {
  const t = useMessages("admin").billing;
  const cls = PILL_CLS[status] ?? PILL_CLS.unpaid;
  const label = (t.pill as Record<string, string>)[status] ?? t.pill.unpaid;
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

export default function AdminBillingPage() {
  const t = useMessages("admin").billing;
  const qc = useQueryClient();
  // Billing documents accumulate forever, so they arrive a page at a time.
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminInvoice[]>([]);
  const { data: pageData, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: [...INVOICES_KEY, page],
    queryFn: async () => {
      const res = await superAdminApi.getInvoicesPage(page);
      setRows((prev) => (page === 1 ? res.items : appendPage(prev, res.items)));
      return res;
    },
    placeholderData: keepPreviousData,
  });
  const data = rows;
  const [sel, setSel] = useState<AdminInvoice | null>(null);

  // The document is the server's to issue — number, kind and tax split included.
  const docQ = useQuery({
    queryKey: ["admin", "invoices", "document", sel?.id],
    queryFn: () => superAdminApi.getInvoiceDocument(sel!.id),
    enabled: !!sel,
  });

  const payM = useMutation({
    mutationFn: (id: string) => superAdminApi.markInvoicePaid(id),
    onSuccess: (updated) => {
      setSel(updated); // reflect receipt immediately in the open modal
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectM = useMutation({
    mutationFn: (id: string) => {
      const reason = window.prompt(t.rejectPrompt) ?? undefined;
      return superAdminApi.rejectInvoice(id, reason);
    },
    onSuccess: (updated) => {
      setSel(updated);
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendM = useMutation({
    mutationFn: (id: string) => superAdminApi.sendInvoice(id),
    onSuccess: (res) =>
      res.sent
        ? toast.success(interp(t.sendSuccess, { doc: res.isReceipt ? t.receiptWord : t.invoiceWord, email: res.email ?? "" }))
        : toast.error(t.sendFailed),
    onError: (e: Error) => toast.error(e.message),
  });

  const paid = sel ? isPaid(sel) : false;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message={t.empty} />}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[680px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t.colNumber}</th>
                  <th className="px-4 py-3">{t.colOrg}</th>
                  <th className="px-4 py-3 text-right">{t.colAmount}</th>
                  <th className="px-4 py-3">{t.colStatus}</th>
                  <th className="px-4 py-3">{t.colIssued}</th>
                  <th className="px-4 py-3">{t.colDue}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.map((inv) => (
                  <tr key={inv.id} onClick={() => setSel(inv)} className="cursor-pointer hover:bg-app/60">
                    <td data-label={t.colNumber} className="px-4 py-3 font-medium">{inv.number}</td>
                    <td data-label={t.colOrg} className="px-4 py-3">{inv.organizationName}</td>
                    <td data-label={t.colAmount} className="px-4 py-3 text-right font-semibold text-brand">฿{fmt.format(inv.amount)}</td>
                    <td data-label={t.colStatus} className="px-4 py-3">
                      <StatusPill status={inv.status} />
                    </td>
                    <td data-label={t.colIssued} className="px-4 py-3 text-muted-foreground">{inv.issueDate}</td>
                    <td data-label={t.colDue} className="px-4 py-3 text-muted-foreground">{inv.dueDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LoadMore
            shown={data.length}
            total={pageData?.total ?? data.length}
            hasMore={pageData?.hasMore ?? false}
            loading={isFetching}
            onMore={() => setPage((p) => p + 1)}
          />
        </div>
      )}

      {sel && (
        <Modal
          title={docQ.data?.title ?? (paid ? t.receiptTitle : t.invoiceTitle)}
          onClose={() => setSel(null)}
          // Wider than the default: this dialog also shows the transfer slip
          // and carries four actions.
          width="max-w-lg"
          footer={
            <>
              {!paid && sel.status !== "rejected" && (
                <Button type="button" onClick={() => payM.mutate(sel.id)} disabled={payM.isPending}>
                  <CheckCircle2 className="size-4" />{" "}
                  {payM.isPending
                    ? t.saving
                    : sel.status === "pending_review"
                      ? t.approveRenew
                      : t.markPaid}
                </Button>
              )}
              {sel.status === "pending_review" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => rejectM.mutate(sel.id)}
                  disabled={rejectM.isPending}
                >
                  <XCircle className="size-4" /> {rejectM.isPending ? t.saving : t.reject}
                </Button>
              )}
              {docQ.data && (
                <OpenPdfButton
                  kind={docQ.data.kind}
                  onFetch={() => superAdminApi.getInvoiceDocumentPdf(sel.id)}
                />
              )}
              <Button
                type="button"
                variant={paid ? "default" : "outline"}
                onClick={() => sendM.mutate(sel.id)}
                disabled={sendM.isPending}
              >
                <Mail className="size-4" /> {sendM.isPending ? t.sending : paid ? t.sendReceipt : t.sendInvoice}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {/* The document itself — server-issued, identical to the venue's copy. */}
            {docQ.isLoading && <Loading rows={3} />}
            {docQ.data && <BillingDocument doc={docQ.data} />}

            {/* Review context, not part of the document: the slip that was sent,
                and why a previous one was turned down. */}
            {sel.slipUrl && (
              <div className="rounded-xl bg-app/60 p-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">{t.slipTitle}</span>
                  <a href={sel.slipUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand">
                    {t.openFull}
                  </a>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sel.slipUrl}
                  alt={interp(t.slipAlt, { name: sel.organizationName })}
                  className="max-h-72 w-full rounded-lg object-contain ring-1 ring-black/5"
                />
              </div>
            )}

            {sel.rejectReason && (
              <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
                {interp(t.rejectedReason, { reason: sel.rejectReason })}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
