"use client";
import { toast } from "@/lib/toast";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminSupportTicket } from "@/lib/types";
import { CheckCircle2, Send } from "lucide-react";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useMessages, useLocale } from "@/lib/i18n/context";
import { fmt as interp, intlLocale } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";

const STATUS_CLS: Record<string, string> = {
  open: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  pending: "bg-blue-100 text-blue-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-muted text-muted-foreground",
};
const PRIORITY_CLS: Record<string, string> = {
  high: "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-muted text-muted-foreground",
};

function fmtDate(iso: string | null, locale: Locale) {
  return iso ? new Date(iso).toLocaleDateString(intlLocale(locale)) : "—";
}

export default function AdminSupportPage() {
  const tx = useMessages("admin").support;
  const { locale } = useLocale();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "support-tickets"],
    queryFn: superAdminApi.getSupportTickets,
  });
  const [sel, setSel] = useState<AdminSupportTicket | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{tx.title}</h1>
        <p className="text-sm text-muted-foreground">{tx.subtitle}</p>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message={tx.empty} />}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[720px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{tx.colTicket}</th>
                  <th className="px-4 py-3">{tx.colOrg}</th>
                  <th className="px-4 py-3">{tx.colSubject}</th>
                  <th className="px-4 py-3">{tx.colPriority}</th>
                  <th className="px-4 py-3">{tx.colStatus}</th>
                  <th className="px-4 py-3">{tx.colUpdated}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.map((t) => {
                  const stCls = STATUS_CLS[t.status] ?? "bg-muted text-muted-foreground";
                  const stLabel = (tx.status as Record<string, string>)[t.status] ?? t.status;
                  const prCls = PRIORITY_CLS[t.priority] ?? "bg-muted text-muted-foreground";
                  const prLabel = (tx.priority as Record<string, string>)[t.priority] ?? t.priority;
                  return (
                    <tr key={t.id} onClick={() => setSel(t)} className="cursor-pointer hover:bg-app/60">
                      <td data-label={tx.colTicket} className="px-4 py-3 font-medium">{t.ticketNo}</td>
                      <td data-label={tx.colOrg} className="px-4 py-3">{t.organizationName}</td>
                      <td data-label={tx.colSubject} className="px-4 py-3 text-muted-foreground">{t.subject}</td>
                      <td data-label={tx.colPriority} className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${prCls}`}>{prLabel}</span>
                      </td>
                      <td data-label={tx.colStatus} className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${stCls}`}>{stLabel}</span>
                      </td>
                      <td data-label={tx.colUpdated} className="px-4 py-3 text-muted-foreground">{fmtDate(t.updatedAt, locale)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sel && <TicketModal ticket={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

/**
 * A ticket's whole thread, with the two things the desk actually needs: an
 * answer box and a way to close it. Replies are emailed to the venue, which is
 * the only channel they have — there is no venue-side support inbox.
 */
function TicketModal({ ticket, onClose }: { ticket: AdminSupportTicket; onClose: () => void }) {
  const tx = useMessages("admin").support;
  const { locale } = useLocale();
  const qc = useQueryClient();
  const [body, setBody] = useState("");

  // Refetched so the thread is current even if the list row is stale.
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "support-ticket", ticket.id],
    queryFn: () => superAdminApi.getSupportTicket(ticket.id),
    initialData: ticket,
  });
  const t = data ?? ticket;

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin", "support"] });
    qc.invalidateQueries({ queryKey: ["admin", "support-ticket", ticket.id] });
  }

  const reply = useMutation({
    mutationFn: () => superAdminApi.replySupportTicket(ticket.id, body.trim()),
    onSuccess: () => {
      setBody("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: (status: string) => superAdminApi.updateSupportTicketStatus(ticket.id, status),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const stCls = STATUS_CLS[t.status] ?? "bg-muted text-muted-foreground";
  const stLabel = (tx.status as Record<string, string>)[t.status] ?? t.status;
  const prCls = PRIORITY_CLS[t.priority] ?? "bg-muted text-muted-foreground";
  const prLabel = (tx.priority as Record<string, string>)[t.priority] ?? t.priority;
  const settled = t.status === "resolved" || t.status === "closed";

  return (
    <Modal
      title={interp(tx.ticketTitle, { no: t.ticketNo })}
      onClose={onClose}
      width="max-w-xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {tx.closeWindow}
          </Button>
          {settled ? (
            <Button type="button" variant="outline" onClick={() => setStatus.mutate("open")} disabled={setStatus.isPending}>
              {tx.reopen}
            </Button>
          ) : (
            <Button type="button" onClick={() => setStatus.mutate("resolved")} disabled={setStatus.isPending}>
              <CheckCircle2 className="size-4" /> {setStatus.isPending ? tx.saving : tx.resolveCase}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div>
          <div className="text-muted-foreground">{tx.rowSubject}</div>
          <div className="font-semibold">{t.subject}</div>
          {t.body && <p className="mt-1 whitespace-pre-line text-muted-foreground">{t.body}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-muted-foreground">{tx.rowOrg}</div>
            <div className="font-medium">{t.organizationName}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{tx.rowAssignee}</div>
            <div className="font-medium">{t.assignedTo ?? tx.dash}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{tx.rowPriority}</div>
            <span className={`mt-0.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${prCls}`}>{prLabel}</span>
          </div>
          <div>
            <div className="text-muted-foreground">{tx.rowStatus}</div>
            <span className={`mt-0.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${stCls}`}>{stLabel}</span>
          </div>
        </div>

        {/* Thread */}
        <div className="space-y-2 border-t border-black/5 pt-3">
          <div className="text-sm font-semibold">{tx.conversation}</div>
          {isLoading && <p className="text-muted-foreground">{tx.loading}</p>}
          {(t.replies ?? []).length === 0 && !isLoading && (
            <p className="text-muted-foreground">{tx.noReplies}</p>
          )}
          {(t.replies ?? []).map((r) => (
            <div
              key={r.id}
              className={`rounded-xl p-3 ${r.authorSide === "platform" ? "bg-brand/5" : "bg-app"}`}
            >
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{r.authorName}</span>
                <span>{fmtDate(r.createdAt, locale)}</span>
              </div>
              <p className="mt-1 whitespace-pre-line">{r.body}</p>
              {r.authorSide === "platform" && !r.emailed && (
                <p className="mt-1 text-xs text-amber-700">
                  {tx.emailFailed}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Reply */}
        <div className="space-y-2 border-t border-black/5 pt-3">
          <label htmlFor="reply-body" className="text-sm font-semibold">
            {tx.replyLabel}
          </label>
          <textarea
            id="reply-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={tx.replyPlaceholder}
            className="w-full rounded-xl border border-input bg-white p-3 text-sm outline-none focus-visible:border-ring"
          />
          <Button
            type="button"
            onClick={() => reply.mutate()}
            disabled={!body.trim() || reply.isPending}
          >
            <Send className="size-4" /> {reply.isPending ? tx.sending : tx.sendReply}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
