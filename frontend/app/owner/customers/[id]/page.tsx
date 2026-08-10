"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BellOff,
  CalendarClock,
  CheckSquare,
  Crown,
  Mail,
  Phone,
  Plus,
  ShieldCheck,
  ShieldQuestion,
  Square,
  StickyNote,
  Trash2,
  Wallet,
} from "lucide-react";
import { ownerApi } from "@/lib/api/owner";
import type { OwnerCustomerNote, OwnerCustomerTask } from "@/lib/types";
import { Loading, ErrorState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const fmt = new Intl.NumberFormat("th-TH");

function thaiDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * One customer, as the counter needs them: who they are, what they are worth,
 * and what they have booked recently.
 */
export default function OwnerCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "customer", id],
    queryFn: () => ownerApi.getCustomer(id),
  });

  if (isLoading) return <Loading rows={4} />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <Link
        href="/owner/customers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> กลับไปรายชื่อลูกค้า
      </Link>

      <header className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        {data.pictureUrl ? (
          // The customer's own LINE photo, when they have one.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.pictureUrl} alt="" className="size-14 rounded-full object-cover ring-1 ring-black/10" />
        ) : (
          <span className="grid size-14 place-items-center rounded-full bg-brand text-xl font-bold text-brand-foreground">
            {data.displayName.trim().charAt(0).toUpperCase()}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{data.displayName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {data.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3.5" /> {data.phone}
              </span>
            )}
            {data.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5" /> {data.email}
              </span>
            )}
            <span>ลูกค้าตั้งแต่ {thaiDate(data.joinedAt)}</span>
          </div>
        </div>

        {/* Staff see the answer before they market to someone. Read-only on
            purpose: there is no endpoint for a venue to tick this for a
            customer, because that would not be consent. */}
        <ConsentBadge
          consent={data.marketingConsent}
          unsubscribedAt={data.unsubscribedAt}
        />

        {data.membership?.tier && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-accent/15 px-3 py-1 text-sm font-semibold text-brand">
            <Crown className="size-4" /> {data.membership.tier}
          </span>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="ยอดใช้จ่ายรวม" value={`฿${fmt.format(data.totalSpending)}`} accent />
        <Stat label="การจองทั้งหมด" value={fmt.format(data.bookingsCount)} />
        <Stat label="เข้าใช้บริการ" value={fmt.format(data.visits)} />
        <Stat
          label="วอลเล็ต"
          value={`฿${fmt.format(data.walletBalance)}`}
          icon={<Wallet className="size-4 text-muted-foreground" />}
        />
      </div>

      {data.membership && (
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="text-sm text-muted-foreground">คะแนนสะสม</div>
          <div className="text-2xl font-bold">{fmt.format(data.membership.points)}</div>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <header className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          <h2 className="font-semibold">การจองล่าสุด</h2>
          <span className="text-xs text-muted-foreground">
            {data.recentBookings.length < data.bookingsCount
              ? `แสดง ${data.recentBookings.length} จาก ${fmt.format(data.bookingsCount)} รายการ`
              : `${data.recentBookings.length} รายการ`}
          </span>
        </header>

        {data.recentBookings.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">ยังไม่เคยจอง</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[560px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">รหัส</th>
                  <th className="px-4 py-3">คอร์ท</th>
                  <th className="px-4 py-3">วันและเวลา</th>
                  <th className="px-4 py-3">ยอด</th>
                  <th className="px-4 py-3">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.recentBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-app/60">
                    <td data-label="รหัส" className="px-4 py-3 font-mono text-xs text-muted-foreground">{b.code ?? "—"}</td>
                    <td data-label="คอร์ท" className="px-4 py-3 font-medium">{b.courtName ?? "—"}</td>
                    <td data-label="วันและเวลา" className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="size-3.5 text-muted-foreground" />
                        {thaiDate(b.date)} · {b.start}–{b.end}
                      </span>
                    </td>
                    <td data-label="ยอด" className="px-4 py-3">฿{fmt.format(b.amount)}</td>
                    <td data-label="สถานะ" className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <NotesCard customerId={id} notes={data.notes} />
        <TasksCard customerId={id} tasks={data.tasks} />
      </div>
    </div>
  );
}

/* -------------------------------- Notes -------------------------------- */

function NotesCard({ customerId, notes }: { customerId: string; notes: OwnerCustomerNote[] }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["owner", "customer", customerId] });

  const add = useMutation({
    mutationFn: () => ownerApi.addCustomerNote(customerId, body.trim()),
    onSuccess: () => { setBody(""); invalidate(); },
  });
  const del = useMutation({
    mutationFn: (noteId: string) => ownerApi.deleteCustomerNote(customerId, noteId),
    onSuccess: invalidate,
  });

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <h2 className="inline-flex items-center gap-2 font-semibold">
        <StickyNote className="size-4 text-brand" /> โน้ตลูกค้า
      </h2>

      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); if (body.trim()) add.mutate(); }}
      >
        <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="เช่น ชอบเล่นเย็น ๆ ขอคอร์ท 3" />
        <Button type="submit" disabled={!body.trim() || add.isPending}>
          <Plus className="size-4" /> เพิ่ม
        </Button>
      </form>

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีโน้ต</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="group flex items-start gap-2 rounded-xl bg-app px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap break-words">{n.body}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {n.author ?? "พนักงาน"} · {thaiDate(n.createdAt)}
                </p>
              </div>
              <button
                type="button"
                aria-label="ลบโน้ต"
                onClick={() => del.mutate(n.id)}
                className="shrink-0 rounded-lg p-1 text-muted-foreground opacity-0 transition hover:bg-white hover:text-brand-danger group-hover:opacity-100"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------- Tasks -------------------------------- */

function TasksCard({ customerId, tasks }: { customerId: string; tasks: OwnerCustomerTask[] }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["owner", "customer", customerId] });

  const add = useMutation({
    mutationFn: () => ownerApi.addCustomerTask(customerId, { title: title.trim(), dueAt: dueAt || undefined }),
    onSuccess: () => { setTitle(""); setDueAt(""); invalidate(); },
  });
  const toggle = useMutation({
    mutationFn: (taskId: string) => ownerApi.toggleCustomerTask(customerId, taskId),
    onSuccess: invalidate,
  });
  const del = useMutation({
    mutationFn: (taskId: string) => ownerApi.deleteCustomerTask(customerId, taskId),
    onSuccess: invalidate,
  });

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <h2 className="inline-flex items-center gap-2 font-semibold">
        <CheckSquare className="size-4 text-brand" /> งานติดตาม
      </h2>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => { e.preventDefault(); if (title.trim()) add.mutate(); }}
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น โทรตามลูกค้าที่หายไป" className="min-w-[10rem] flex-1" />
        <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="w-40" />
        <Button type="submit" disabled={!title.trim() || add.isPending}>
          <Plus className="size-4" /> เพิ่ม
        </Button>
      </form>

      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีงานติดตาม</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const done = t.status === "done";
            return (
              <li key={t.id} className="group flex items-start gap-2 rounded-xl bg-app px-3 py-2 text-sm">
                <button
                  type="button"
                  aria-label={done ? "ทำเครื่องหมายยังไม่เสร็จ" : "ทำเครื่องหมายเสร็จ"}
                  onClick={() => toggle.mutate(t.id)}
                  className={`mt-0.5 shrink-0 ${done ? "text-brand" : "text-muted-foreground hover:text-brand"}`}
                >
                  {done ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`break-words ${done ? "text-muted-foreground line-through" : ""}`}>{t.title}</p>
                  {(t.dueAt || t.assignee) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.dueAt && <>กำหนด {thaiDate(t.dueAt)}</>}
                      {t.dueAt && t.assignee && " · "}
                      {t.assignee && <>ผู้รับผิดชอบ {t.assignee}</>}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="ลบงาน"
                  onClick={() => del.mutate(t.id)}
                  className="shrink-0 rounded-lg p-1 text-muted-foreground opacity-0 transition hover:bg-white hover:text-brand-danger group-hover:opacity-100"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Three states, said plainly — "never asked" is not "said no". */
function ConsentBadge({
  consent,
  unsubscribedAt,
}: {
  consent: boolean | null;
  unsubscribedAt: string | null;
}) {
  if (unsubscribedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-700">
        <BellOff className="size-4" /> ขอไม่รับข่าวโปรโมชั่น
      </span>
    );
  }

  if (consent === true) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
        <ShieldCheck className="size-4" /> ยินยอมรับข่าวสาร
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-app px-3 py-1 text-sm text-muted-foreground">
      <ShieldQuestion className="size-4" /> ยังไม่ได้ถามเรื่องความยินยอม
    </span>
  );
}

function Stat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-0.5 text-2xl font-bold ${accent ? "text-brand" : ""}`}>{value}</div>
    </div>
  );
}
