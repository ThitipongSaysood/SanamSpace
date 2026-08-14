"use client";
import { toast } from "@/lib/toast";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { ownerApi } from "@/lib/api/owner";
import { useSeenMap, supportTicketHasUnread, LAST_SEEN_KEYS } from "@/lib/last-seen";
import { Loading, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import type { OwnerSupportTicket } from "@/lib/types";
import { useMessages, useLocale } from "@/lib/i18n/context";
import { intlLocale } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";

const STATUS_CLS: Record<OwnerSupportTicket["status"], string> = {
  open: "bg-amber-100 text-amber-700",
  pending: "bg-blue-100 text-blue-700",
  resolved: "bg-brand/10 text-brand",
  closed: "bg-slate-100 text-slate-600",
};

const PRIORITY_VALUES = ["low", "medium", "high"] as const;

function when(iso: string | null, locale: Locale) {
  return iso ? new Date(iso).toLocaleString(intlLocale(locale), { dateStyle: "medium", timeStyle: "short" }) : "";
}

/**
 * Where a venue asks the platform for help.
 *
 * The sidebar had said "ติดต่อฝ่ายสนับสนุน" since the portal was built, and the
 * link went to the settings page. On the platform side the support desk could
 * read tickets, answer them and close them — fed entirely by seeded rows,
 * because nothing anywhere could create one.
 */
export default function OwnerSupportPage() {
  const t = useMessages("owner").support;
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "support-tickets"],
    queryFn: ownerApi.getSupportTickets,
  });

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("medium");
  const [openId, setOpenId] = useState<string | null>(null);

  // Per-ticket read state: which threads still hold an unread platform reply.
  // Opening a ticket marks that one read — not the whole page — so with many
  // threads the owner can still tell which ones are new.
  const [seen, markSeenTicket] = useSeenMap(LAST_SEEN_KEYS.support);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["owner", "support-tickets"] });
  }

  const create = useMutation({
    mutationFn: () => ownerApi.createSupportTicket({ subject, body, priority }),
    onSuccess: (ticket) => {
      refresh();
      setSubject("");
      setBody("");
      setPriority("medium");
      setOpenId(ticket.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </header>

      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="text-sm font-semibold">{t.newTicket}</h2>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t.subjectPlaceholder}
          maxLength={200}
          className="h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus-visible:border-ring"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder={t.bodyPlaceholder}
          maxLength={5000}
          className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus-visible:border-ring"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="h-10 rounded-lg border border-input px-2.5 text-sm outline-none focus-visible:border-ring"
          >
            {PRIORITY_VALUES.map((p) => (
              <option key={p} value={p}>
                {t.priority[p]}
              </option>
            ))}
          </select>
          <Button
            type="button"
            onClick={() => create.mutate()}
            disabled={!subject.trim() || !body.trim() || create.isPending}
          >
            <Send className="size-4" /> {create.isPending ? t.sending : t.submit}
          </Button>
        </div>
      </section>

      {isLoading && <Loading rows={2} />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <div className="grid place-items-center rounded-2xl bg-app/50 py-12 text-center text-sm text-muted-foreground">
          {t.empty}
        </div>
      )}

      {data?.map((ticket) => (
        <Thread
          key={ticket.id}
          ticket={ticket}
          open={openId === ticket.id}
          unread={supportTicketHasUnread(ticket, seen)}
          onToggle={() => {
            const willOpen = openId !== ticket.id;
            setOpenId(willOpen ? ticket.id : null);
            if (willOpen) markSeenTicket(ticket.id); // reading it clears its dot
          }}
          onReplied={refresh}
        />
      ))}
    </div>
  );
}

function Thread({
  ticket,
  open,
  unread,
  onToggle,
  onReplied,
}: {
  ticket: OwnerSupportTicket;
  open: boolean;
  unread: boolean;
  onToggle: () => void;
  onReplied: () => void;
}) {
  const t = useMessages("owner").support;
  const { locale } = useLocale();
  const [reply, setReply] = useState("");
  const statusCls = STATUS_CLS[ticket.status] ?? "bg-slate-100 text-slate-600";
  const statusLabel = (t.status as Record<string, string>)[ticket.status] ?? ticket.status;

  const send = useMutation({
    mutationFn: () => ownerApi.replyToSupportTicket(ticket.id, reply),
    onSuccess: () => {
      setReply("");
      onReplied();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-3 text-left">
        <div className="flex min-w-0 items-start gap-2">
          {unread && <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-red-500" />}
          <div className="min-w-0">
            <div className="font-semibold">{ticket.subject}</div>
            <div className="text-xs text-muted-foreground">
              {ticket.ticketNo} · {when(ticket.createdAt, locale)}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {unread && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">{t.unread}</span>
          )}
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCls}`}>{statusLabel}</span>
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {ticket.replies.map((r) => (
            <div
              key={r.id}
              className={`rounded-xl p-3 text-sm ${
                r.authorSide === "platform" ? "bg-brand/5 ring-1 ring-brand/20" : "bg-app"
              }`}
            >
              <div className="text-xs text-muted-foreground">
                {r.authorSide === "platform" ? t.platformTeam : r.authorName} · {when(r.createdAt, locale)}
              </div>
              <p className="mt-1 whitespace-pre-wrap">{r.body}</p>
            </div>
          ))}

          <div className="space-y-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              placeholder={t.replyPlaceholder}
              maxLength={5000}
              className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus-visible:border-ring"
            />
            {/* Replying to a settled ticket reopens it — if the venue is still
                talking, it is not resolved. */}
            <Button type="button" size="sm" onClick={() => send.mutate()} disabled={!reply.trim() || send.isPending}>
              {send.isPending ? t.sending : t.sendReply}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
