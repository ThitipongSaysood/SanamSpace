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

const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "เปิด", cls: "bg-amber-100 text-amber-700" },
  in_progress: { label: "กำลังดำเนินการ", cls: "bg-blue-100 text-blue-700" },
  pending: { label: "รอลูกค้าตอบ", cls: "bg-blue-100 text-blue-700" },
  resolved: { label: "แก้ไขแล้ว", cls: "bg-emerald-100 text-emerald-700" },
  closed: { label: "ปิด", cls: "bg-muted text-muted-foreground" },
};
const PRIORITY: Record<string, { label: string; cls: string }> = {
  high: { label: "สูง", cls: "bg-rose-100 text-rose-700" },
  medium: { label: "กลาง", cls: "bg-amber-100 text-amber-700" },
  low: { label: "ต่ำ", cls: "bg-muted text-muted-foreground" },
};

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("th-TH") : "—";
}

export default function AdminSupportPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "support-tickets"],
    queryFn: superAdminApi.getSupportTickets,
  });
  const [sel, setSel] = useState<AdminSupportTicket | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">ศูนย์ช่วยเหลือ</h1>
        <p className="text-sm text-muted-foreground">ตั๋วช่วยเหลือจากสนามที่เช่าระบบ</p>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มีตั๋ว" />}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[720px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Ticket #</th>
                  <th className="px-4 py-3">องค์กร</th>
                  <th className="px-4 py-3">เรื่อง</th>
                  <th className="px-4 py-3">ความสำคัญ</th>
                  <th className="px-4 py-3">สถานะ</th>
                  <th className="px-4 py-3">อัปเดต</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.map((t) => {
                  const st = STATUS[t.status] ?? { label: t.status, cls: "bg-muted text-muted-foreground" };
                  const pr = PRIORITY[t.priority] ?? { label: t.priority, cls: "bg-muted text-muted-foreground" };
                  return (
                    <tr key={t.id} onClick={() => setSel(t)} className="cursor-pointer hover:bg-app/60">
                      <td data-label="Ticket #" className="px-4 py-3 font-medium">{t.ticketNo}</td>
                      <td data-label="องค์กร" className="px-4 py-3">{t.organizationName}</td>
                      <td data-label="เรื่อง" className="px-4 py-3 text-muted-foreground">{t.subject}</td>
                      <td data-label="ความสำคัญ" className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${pr.cls}`}>{pr.label}</span>
                      </td>
                      <td data-label="สถานะ" className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                      </td>
                      <td data-label="อัปเดต" className="px-4 py-3 text-muted-foreground">{fmtDate(t.updatedAt)}</td>
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

  const st = STATUS[t.status] ?? { label: t.status, cls: "bg-muted text-muted-foreground" };
  const pr = PRIORITY[t.priority] ?? { label: t.priority, cls: "bg-muted text-muted-foreground" };
  const settled = t.status === "resolved" || t.status === "closed";

  return (
    <Modal
      title={`Ticket ${t.ticketNo}`}
      onClose={onClose}
      width="max-w-xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            ปิดหน้าต่าง
          </Button>
          {settled ? (
            <Button type="button" variant="outline" onClick={() => setStatus.mutate("open")} disabled={setStatus.isPending}>
              เปิดเคสใหม่
            </Button>
          ) : (
            <Button type="button" onClick={() => setStatus.mutate("resolved")} disabled={setStatus.isPending}>
              <CheckCircle2 className="size-4" /> {setStatus.isPending ? "กำลังบันทึก..." : "ปิดเคส (แก้ไขแล้ว)"}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div>
          <div className="text-muted-foreground">เรื่อง</div>
          <div className="font-semibold">{t.subject}</div>
          {t.body && <p className="mt-1 whitespace-pre-line text-muted-foreground">{t.body}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-muted-foreground">องค์กร</div>
            <div className="font-medium">{t.organizationName}</div>
          </div>
          <div>
            <div className="text-muted-foreground">ผู้รับผิดชอบ</div>
            <div className="font-medium">{t.assignedTo ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">ความสำคัญ</div>
            <span className={`mt-0.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${pr.cls}`}>{pr.label}</span>
          </div>
          <div>
            <div className="text-muted-foreground">สถานะ</div>
            <span className={`mt-0.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
          </div>
        </div>

        {/* Thread */}
        <div className="space-y-2 border-t border-black/5 pt-3">
          <div className="text-sm font-semibold">การสนทนา</div>
          {isLoading && <p className="text-muted-foreground">กำลังโหลด...</p>}
          {(t.replies ?? []).length === 0 && !isLoading && (
            <p className="text-muted-foreground">ยังไม่มีการตอบกลับ</p>
          )}
          {(t.replies ?? []).map((r) => (
            <div
              key={r.id}
              className={`rounded-xl p-3 ${r.authorSide === "platform" ? "bg-brand/5" : "bg-app"}`}
            >
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{r.authorName}</span>
                <span>{fmtDate(r.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-line">{r.body}</p>
              {r.authorSide === "platform" && !r.emailed && (
                <p className="mt-1 text-xs text-amber-700">
                  ⚠️ ส่งอีเมลไม่ได้ (ไม่พบอีเมลติดต่อของสนาม) — ลูกค้าอาจยังไม่เห็นข้อความนี้
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Reply */}
        <div className="space-y-2 border-t border-black/5 pt-3">
          <label htmlFor="reply-body" className="text-sm font-semibold">
            ตอบกลับ
          </label>
          <textarea
            id="reply-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="พิมพ์คำตอบถึงสนาม — ระบบจะส่งอีเมลให้อัตโนมัติ"
            className="w-full rounded-xl border border-input bg-white p-3 text-sm outline-none focus-visible:border-ring"
          />
          <Button
            type="button"
            onClick={() => reply.mutate()}
            disabled={!body.trim() || reply.isPending}
          >
            <Send className="size-4" /> {reply.isPending ? "กำลังส่ง..." : "ส่งคำตอบ"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
