"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, ExternalLink, History, MessageCircle, Power, RefreshCw, Trash2, UserCog, X } from "lucide-react";
import { superAdminApi } from "@/lib/api/superadmin";
import { setOwnerToken } from "@/lib/api/owner";
import { Loading, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Modal } from "../_components/modal";

const fmt = new Intl.NumberFormat("th-TH");
const TABS = ["ข้อมูลทั่วไป", "การสมัครใช้งาน", "LINE", "การใช้งาน", "ประวัติ"] as const;
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

function Bar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {used}
          {limit != null ? ` / ${limit}` : ""}
          {pct != null && <span className="ml-1 text-xs text-muted-foreground">({pct}%)</span>}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-app">
        <div className={`h-2 rounded-full ${pct != null && pct >= 90 ? "bg-rose-500" : "bg-brand"}`} style={{ width: pct != null ? `${pct}%` : "10%" }} />
      </div>
    </div>
  );
}

export function OrgDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>("ข้อมูลทั่วไป");
  const [showPlans, setShowPlans] = useState(false);
  const [planId, setPlanId] = useState("");
  const [confirmImp, setConfirmImp] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "organization", id],
    queryFn: () => superAdminApi.getOrganization(id),
  });
  const plansQ = useQuery({ queryKey: ["admin", "plans"], queryFn: superAdminApi.getPlans, enabled: showPlans });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin", "organization", id] });
    qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
  }

  const statusM = useMutation({
    mutationFn: () => (data?.status === "suspended" ? superAdminApi.activateOrg(id) : superAdminApi.suspendOrg(id)),
    onSuccess: invalidate,
    onError: (e: Error) => window.alert(e.message),
  });
  const planM = useMutation({
    mutationFn: () => superAdminApi.changeOrgPlan(id, planId),
    onSuccess: () => {
      invalidate();
      setShowPlans(false);
    },
    onError: (e: Error) => window.alert(e.message),
  });
  const delM = useMutation({
    mutationFn: () => superAdminApi.deleteOrg(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
      onClose();
    },
    onError: (e: Error) => window.alert(e.message),
  });

  // LINE per-venue override form. Secrets stay blank (write-only); typing a value
  // sets it, leaving blank keeps the existing one.
  const [line, setLine] = useState({ channelId: "", liffId: "", channelSecret: "", messagingToken: "" });
  useEffect(() => {
    if (data?.settings) {
      setLine((prev) => ({
        ...prev,
        channelId: data.settings?.lineChannelId ?? "",
        liffId: data.settings?.lineLiffId ?? "",
      }));
    }
  }, [data?.settings]);

  const lineM = useMutation({
    mutationFn: () =>
      superAdminApi.updateOrganizationSettings(id, {
        lineChannelId: line.channelId,
        lineLiffId: line.liffId,
        ...(line.channelSecret ? { lineChannelSecret: line.channelSecret } : {}),
        ...(line.messagingToken ? { lineMessagingToken: line.messagingToken } : {}),
      }),
    onSuccess: () => {
      invalidate();
      setLine((prev) => ({ ...prev, channelSecret: "", messagingToken: "" }));
      window.alert("บันทึกการตั้งค่า LINE แล้ว");
    },
    onError: (e: Error) => window.alert(e.message),
  });

  async function impersonate() {
    try {
      const res = await superAdminApi.impersonateOrg(id);
      setOwnerToken(res.token);
      try {
        window.localStorage.setItem("sanamspace.owner_user", JSON.stringify(res.user));
      } catch {
        /* ignore */
      }
      window.location.href = "/owner";
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  const sub = data?.subscription;
  const suspended = data?.status === "suspended";
  const active = data ? !suspended && data.subscriptionStatus === "active" : false;

  return (
    <>
    <aside
      role="dialog"
      aria-label="รายละเอียดสนาม"
      className="flex w-full shrink-0 flex-col overflow-y-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-7rem)] xl:w-[380px]"
    >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/5 bg-white px-5 py-4">
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
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand/10 text-sm font-bold text-brand">
                {data.name.trim().slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{data.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {active ? "ใช้งานอยู่" : suspended ? "ระงับ" : data.subscriptionStatus ?? "—"}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">{sub?.planName ? `${sub.planName} Plan` : "—"}</div>
              </div>
            </div>

            <div className="flex gap-1 overflow-x-auto border-b border-black/5 text-sm">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`-mb-px shrink-0 border-b-2 px-2.5 py-2 font-medium transition ${tab === t ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === "ข้อมูลทั่วไป" ? (
              <>
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

                  {showPlans ? (
                    <div className="mt-3 space-y-2">
                      <select
                        value={planId}
                        onChange={(e) => setPlanId(e.target.value)}
                        className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
                      >
                        <option value="">— เลือกแพ็กเกจ —</option>
                        {(plansQ.data ?? []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (฿{fmt.format(p.price)})
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={() => planM.mutate()} disabled={!planId || planM.isPending}>
                          {planM.isPending ? "กำลังบันทึก..." : "ยืนยันเปลี่ยน"}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setShowPlans(false)}>
                          ยกเลิก
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowPlans(true)} className="mt-3 w-full rounded-lg border border-brand py-2 text-sm font-semibold text-brand hover:bg-brand/10">
                      จัดการการสมัครใช้งาน
                    </button>
                  )}
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">การดำเนินการ</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setConfirmImp(true)} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-black/10 hover:bg-app">
                      <UserCog className="size-4" /> Impersonate
                    </button>
                    <button
                      type="button"
                      onClick={() => statusM.mutate()}
                      disabled={statusM.isPending}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-black/10 hover:bg-app ${suspended ? "text-emerald-600" : "text-amber-700"}`}
                    >
                      {suspended ? <Power className="size-4" /> : <Clock className="size-4" />}
                      {suspended ? "เปิดใช้งาน" : "ระงับการใช้งาน"}
                    </button>
                    <button type="button" onClick={() => setShowPlans(true)} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-black/10 hover:bg-app">
                      <RefreshCw className="size-4" /> เปลี่ยนแพ็กเกจ
                    </button>
                    <button type="button" onClick={() => window.alert("ฟีเจอร์นี้กำลังพัฒนา")} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-black/10 hover:bg-app">
                      <History className="size-4" /> ดูประวัติการใช้งาน
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.confirm(`ลบสนาม "${data.name}" ? (ระงับเป็นทางเลือกที่ปลอดภัยกว่า)`) && delM.mutate()}
                    disabled={delM.isPending}
                    className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-rose-50 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                  >
                    <Trash2 className="size-4" /> {delM.isPending ? "กำลังลบ..." : "ลบสนาม"}
                  </button>
                </section>
              </>
            ) : tab === "LINE" ? (
              <section className="space-y-4">
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                    <MessageCircle className="size-4 text-brand" /> LINE (ตั้งค่าเฉพาะสนาม)
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ค่าเหล่านี้ใช้แทนค่า LINE ส่วนกลางของแพลตฟอร์มสำหรับสนามนี้เท่านั้น
                  </p>
                </div>

                <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs">
                  <p className="font-medium text-foreground">URL หน้า login ของสนามนี้</p>
                  <code className="mt-1 block break-all rounded bg-white px-2 py-1 text-[11px] text-brand">
                    {typeof window !== "undefined" ? window.location.origin : ""}/v/{data.id}
                  </code>
                  <p className="mt-1.5 text-muted-foreground">
                    ตั้งค่านี้เป็น <b>LIFF Endpoint URL</b> ใน LINE Developers console ของสนาม (ต้องตรงกัน)
                  </p>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Channel ID</span>
                  <input
                    value={line.channelId}
                    onChange={(e) => setLine((p) => ({ ...p, channelId: e.target.value }))}
                    placeholder="เช่น 1234567890"
                    className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">LIFF ID</span>
                  <input
                    value={line.liffId}
                    onChange={(e) => setLine((p) => ({ ...p, liffId: e.target.value }))}
                    placeholder="เช่น 1234567890-abcdEFGH"
                    className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                    Channel Secret
                    {data.settings?.lineChannelSecretSet && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        ตั้งค่าแล้ว
                      </span>
                    )}
                  </span>
                  <input
                    type="password"
                    value={line.channelSecret}
                    onChange={(e) => setLine((p) => ({ ...p, channelSecret: e.target.value }))}
                    placeholder={data.settings?.lineChannelSecretSet ? "••••••• (เว้นว่างเพื่อคงค่าเดิม)" : "กรอกเพื่อตั้งค่า"}
                    autoComplete="new-password"
                    className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                    Messaging API Token
                    {data.settings?.lineMessagingTokenSet && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        ตั้งค่าแล้ว
                      </span>
                    )}
                  </span>
                  <input
                    type="password"
                    value={line.messagingToken}
                    onChange={(e) => setLine((p) => ({ ...p, messagingToken: e.target.value }))}
                    placeholder={data.settings?.lineMessagingTokenSet ? "••••••• (เว้นว่างเพื่อคงค่าเดิม)" : "กรอกเพื่อตั้งค่า"}
                    autoComplete="new-password"
                    className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
                  />
                </label>

                <Button type="button" className="w-full" onClick={() => lineM.mutate()} disabled={lineM.isPending}>
                  {lineM.isPending ? "กำลังบันทึก..." : "บันทึกการตั้งค่า LINE"}
                </Button>
              </section>
            ) : tab === "การใช้งาน" ? (
              <section className="space-y-4">
                <h3 className="text-sm font-semibold">การใช้งานเทียบโควต้าแพ็กเกจ</h3>
                <Bar label="สาขา" used={data.counts.branches} limit={data.plan?.branchLimit ?? null} />
                <Bar label="คอร์ท" used={data.counts.courts} limit={data.plan?.courtLimit ?? null} />
                <Bar label="ลูกค้า" used={data.counts.customers} limit={null} />
              </section>
            ) : (
              <div className="grid place-items-center rounded-xl bg-app/50 py-12 text-center text-sm text-muted-foreground">
                ส่วน “{tab}” กำลังพัฒนา
              </div>
            )}
          </div>
        )}
    </aside>
    {confirmImp && data && (
      <Modal
        title="ยืนยัน Impersonate"
        onClose={() => setConfirmImp(false)}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setConfirmImp(false)}>
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={() => {
                setConfirmImp(false);
                impersonate();
              }}
            >
              เข้าใช้งาน
            </Button>
          </>
        }
      >
        <p className="text-sm">
          คุณกำลังจะเข้าใช้งานในฐานะ <b>{data.name}</b> — จะเข้าถึงข้อมูลทั้งหมดขององค์กรนี้ในหน้า Owner Portal
        </p>
      </Modal>
    )}
    </>
  );
}
