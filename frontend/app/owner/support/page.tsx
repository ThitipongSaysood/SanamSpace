"use client";
import { toast } from "@/lib/toast";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy, Send } from "lucide-react";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import type { OwnerSupportTicket } from "@/lib/types";

const STATUS: Record<OwnerSupportTicket["status"], { label: string; cls: string }> = {
  open: { label: "รอทีมงานตอบ", cls: "bg-amber-100 text-amber-700" },
  pending: { label: "ทีมงานตอบแล้ว", cls: "bg-blue-100 text-blue-700" },
  resolved: { label: "แก้ไขแล้ว", cls: "bg-brand/10 text-brand" },
  closed: { label: "ปิดเรื่อง", cls: "bg-slate-100 text-slate-600" },
};

const PRIORITIES = [
  { value: "low", label: "ไม่เร่ง" },
  { value: "medium", label: "ปกติ" },
  { value: "high", label: "เร่งด่วน — กระทบการใช้งาน" },
];

function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "";
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
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "support-tickets"],
    queryFn: ownerApi.getSupportTickets,
  });

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("medium");
  const [openId, setOpenId] = useState<string | null>(null);

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
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <LifeBuoy className="size-6 text-brand" /> ติดต่อฝ่ายสนับสนุน
        </h1>
        <p className="text-sm text-muted-foreground">แจ้งปัญหาหรือสอบถามทีมงาน SanamSpace</p>
      </header>

      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="text-sm font-semibold">แจ้งเรื่องใหม่</h2>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="เรื่องที่ต้องการแจ้ง"
          maxLength={200}
          className="h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus-visible:border-ring"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="เล่าให้ละเอียดที่สุดเท่าที่ทำได้ — เกิดตอนไหน ทำอะไรอยู่ หน้าจอขึ้นว่าอะไร"
          maxLength={5000}
          className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus-visible:border-ring"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="h-10 rounded-lg border border-input px-2.5 text-sm outline-none focus-visible:border-ring"
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            onClick={() => create.mutate()}
            disabled={!subject.trim() || !body.trim() || create.isPending}
          >
            <Send className="size-4" /> {create.isPending ? "กำลังส่ง..." : "ส่งเรื่อง"}
          </Button>
        </div>
      </section>

      {isLoading && <Loading rows={2} />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <div className="grid place-items-center rounded-2xl bg-app/50 py-12 text-center text-sm text-muted-foreground">
          ยังไม่เคยแจ้งเรื่องไว้
        </div>
      )}

      {data?.map((ticket) => (
        <Thread
          key={ticket.id}
          ticket={ticket}
          open={openId === ticket.id}
          onToggle={() => setOpenId(openId === ticket.id ? null : ticket.id)}
          onReplied={refresh}
        />
      ))}
    </div>
  );
}

function Thread({
  ticket,
  open,
  onToggle,
  onReplied,
}: {
  ticket: OwnerSupportTicket;
  open: boolean;
  onToggle: () => void;
  onReplied: () => void;
}) {
  const [reply, setReply] = useState("");
  const status = STATUS[ticket.status] ?? { label: ticket.status, cls: "bg-slate-100 text-slate-600" };

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
        <div>
          <div className="font-semibold">{ticket.subject}</div>
          <div className="text-xs text-muted-foreground">
            {ticket.ticketNo} · {when(ticket.createdAt)}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
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
                {r.authorSide === "platform" ? "ทีมงาน SanamSpace" : r.authorName} · {when(r.createdAt)}
              </div>
              <p className="mt-1 whitespace-pre-wrap">{r.body}</p>
            </div>
          ))}

          <div className="space-y-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              placeholder="ตอบกลับ"
              maxLength={5000}
              className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus-visible:border-ring"
            />
            {/* Replying to a settled ticket reopens it — if the venue is still
                talking, it is not resolved. */}
            <Button type="button" size="sm" onClick={() => send.mutate()} disabled={!reply.trim() || send.isPending}>
              {send.isPending ? "กำลังส่ง..." : "ส่งข้อความ"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
