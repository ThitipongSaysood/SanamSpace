"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  ExternalLink,
  History,
  RefreshCw,
  Trash2,
  UserCog,
  X,
} from "lucide-react";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState } from "@/components/states";

const fmt = new Intl.NumberFormat("th-TH");
const TABS = ["ข้อมูลทั่วไป", "การสมัครใช้งาน", "ผู้ใช้งาน", "การใช้งาน", "ประวัติ"] as const;
const INTERVAL: Record<string, string> = { month: "รายเดือน", year: "รายปี", monthly: "รายเดือน", yearly: "รายปี" };

function fmtDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString("th-TH") : "—";
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

export function OrgDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("ข้อมูลทั่วไป");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "organization", id],
    queryFn: () => superAdminApi.getOrganization(id),
  });

  const soon = () => window.alert("ฟีเจอร์นี้กำลังพัฒนา");
  const sub = data?.subscription;
  const active = data ? data.status !== "suspended" && data.subscriptionStatus === "active" : false;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button type="button" aria-label="ปิด" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
          <h2 className="font-bold">รายละเอียดสนาม</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-app">
            <X className="size-5" />
          </button>
        </div>

        {isLoading && (
          <div className="p-5">
            <Loading rows={3} />
          </div>
        )}
        {isError && (
          <div className="p-5">
            <ErrorState onRetry={() => refetch()} />
          </div>
        )}

        {data && (
          <div className="flex-1 space-y-5 p-5">
            {/* Header card */}
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand/10 text-sm font-bold text-brand">
                {data.name.trim().slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{data.name}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {active ? "ใช้งานอยู่" : data.status === "suspended" ? "ระงับ" : data.subscriptionStatus ?? "—"}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">{sub?.planName ? `${sub.planName} Plan` : "—"}</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto border-b border-black/5 text-sm">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`-mb-px shrink-0 border-b-2 px-2.5 py-2 font-medium transition ${
                    tab === t ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === "ข้อมูลทั่วไป" ? (
              <>
                {/* Org info */}
                <section className="divide-y divide-black/5">
                  <Row label="ชื่อสนาม">{data.name}</Row>
                  <Row label="เจ้าของ">{data.owner?.name ?? "—"}</Row>
                  <Row label="อีเมล">{data.owner?.email ?? data.settings?.email ?? "—"}</Row>
                  <Row label="เบอร์โทร">{data.settings?.phone ?? "—"}</Row>
                  <Row label="ที่อยู่">{data.settings?.address ?? "—"}</Row>
                  <Row label="วันที่สมัคร">{fmtDate(data.createdAt)}</Row>
                  <Row label="จำนวนสาขา">{data.counts.branches} สาขา</Row>
                  <Row label="LINE OA">
                    {data.settings?.lineOaUrl ? (
                      <a href={data.settings.lineOaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand">
                        {data.settings.lineOaUrl} <ExternalLink className="size-3.5" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </Row>
                </section>

                {/* Current plan */}
                <section className="rounded-xl bg-app/60 p-4">
                  <h3 className="mb-1 text-sm font-semibold">แพ็กเกจปัจจุบัน</h3>
                  <div className="divide-y divide-black/5">
                    <Row label="แพ็กเกจ">{sub?.planName ?? "—"}</Row>
                    <Row label="รอบชำระเงิน">{sub?.interval ? INTERVAL[sub.interval] ?? sub.interval : "—"}</Row>
                    <Row label="วันเริ่มต้น">{fmtDate(sub?.startedAt)}</Row>
                    <Row label="วันหมดอายุ">
                      {fmtDate(sub?.endsAt)}
                      {sub?.daysRemaining != null && (
                        <span className={`ml-1 text-xs ${sub.daysRemaining < 7 ? "text-rose-600" : "text-emerald-600"}`}>
                          ({sub.daysRemaining < 0 ? "หมดอายุ" : `เหลือ ${sub.daysRemaining} วัน`})
                        </span>
                      )}
                    </Row>
                    <Row label="ค่าบริการ">{sub?.price != null ? `฿${fmt.format(sub.price)} / ${sub.interval ? INTERVAL[sub.interval] ?? sub.interval : "เดือน"}` : "—"}</Row>
                  </div>
                  <button type="button" onClick={soon} className="mt-3 w-full rounded-lg border border-brand py-2 text-sm font-semibold text-brand hover:bg-brand/10">
                    จัดการการสมัครใช้งาน
                  </button>
                </section>

                {/* Actions */}
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">การดำเนินการ</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={soon} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-black/10 hover:bg-app">
                      <UserCog className="size-4" /> Impersonate
                    </button>
                    <button type="button" onClick={soon} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-black/10 hover:bg-app">
                      <Clock className="size-4" /> ระงับการใช้งาน
                    </button>
                    <button type="button" onClick={soon} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-black/10 hover:bg-app">
                      <RefreshCw className="size-4" /> เปลี่ยนแพ็กเกจ
                    </button>
                    <button type="button" onClick={soon} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-black/10 hover:bg-app">
                      <History className="size-4" /> ดูประวัติการใช้งาน
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.confirm(`ลบสนาม "${data.name}" ?`) && soon()}
                    className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-rose-50 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100"
                  >
                    <Trash2 className="size-4" /> ลบสนาม
                  </button>
                </section>
              </>
            ) : (
              <div className="grid place-items-center rounded-xl bg-app/50 py-12 text-center text-sm text-muted-foreground">
                ส่วน “{tab}” กำลังพัฒนา
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
