"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, ExternalLink, History, MessageCircle, Power, RefreshCw, Trash2, UserCog, X } from "lucide-react";
import { superAdminApi } from "@/lib/api/superadmin";
import { setOwnerToken } from "@/lib/api/owner";
import type { AdminOrganizationDetail } from "@/lib/types";
import { Loading, ErrorState } from "@/components/states";
import { CustomerLink, customerLinkFor, useOrigin } from "@/components/customer-link";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

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

/** The lengths a venue actually buys. */
const RENEW_MONTHS = [1, 3, 6, 12] as const;
const TRIAL_DAYS = [7, 14, 30] as const;

/**
 * Everything about a venue's subscription, on the screen that shows its expiry
 * date — which is where an admin is standing when they find out it is about to
 * lapse. Renewing used to mean three: read the date here, raise the invoice on
 * the billing page, come back and approve it.
 */
function SubscriptionTab({ org, onDone }: { org: AdminOrganizationDetail; onDone: () => void }) {
  const sub = org.subscription;
  const plans = useQuery({ queryKey: ["admin", "plans"], queryFn: superAdminApi.getPlans });

  const [months, setMonths] = useState<number>(1);
  const [markPaid, setMarkPaid] = useState(false);
  const [planId, setPlanId] = useState("");
  const [trialPlanId, setTrialPlanId] = useState("");
  const [trialDays, setTrialDays] = useState<number>(14);
  const [showExpiry, setShowExpiry] = useState(false);
  const [endsAt, setEndsAt] = useState(sub?.endsAt ? sub.endsAt.slice(0, 10) : "");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState<string | null>(null);

  function fail(e: Error) {
    window.alert(e.message);
  }

  const renewM = useMutation({
    mutationFn: () => superAdminApi.renewOrg(org.id, { months, markPaid }),
    onSuccess: (res) => {
      onDone();
      setNote(
        res.reusedOutstanding
          ? `ใช้ใบแจ้งหนี้ที่ค้างอยู่ ${res.invoice.number} (${res.invoice.periodMonths ?? "?"} เดือน) — ไม่ได้ออกใบใหม่`
          : markPaid
            ? `ต่ออายุแล้ว · ใบเสร็จ ${res.invoice.receiptNumber ?? res.invoice.number}`
            : `ออกใบแจ้งหนี้ ${res.invoice.number} แล้ว — จะต่ออายุเมื่อชำระเงิน`,
      );
    },
    onError: fail,
  });

  const planM = useMutation({
    mutationFn: () => superAdminApi.changeOrgPlan(org.id, planId),
    onSuccess: () => {
      onDone();
      setPlanId("");
      setNote("เปลี่ยนแพ็กเกจแล้ว");
    },
    onError: fail,
  });

  const trialM = useMutation({
    mutationFn: () => superAdminApi.startOrgTrial(org.id, trialPlanId, trialDays),
    onSuccess: () => {
      onDone();
      setNote(`เริ่มทดลองใช้ ${trialDays} วันแล้ว`);
    },
    onError: fail,
  });

  const expiryM = useMutation({
    mutationFn: () => superAdminApi.setOrgExpiry(org.id, endsAt, reason),
    onSuccess: () => {
      onDone();
      setShowExpiry(false);
      setReason("");
      setNote("แก้วันหมดอายุแล้ว — บันทึกไว้ในประวัติการจัดการ");
    },
    onError: fail,
  });

  const perMonth = sub?.interval === "year" && sub.price != null ? sub.price / 12 : sub?.price ?? null;
  const total = perMonth != null ? perMonth * months : null;
  const days = sub?.daysRemaining;

  return (
    <div className="space-y-5">
      {/* Where this venue stands, in one line. */}
      <section className="rounded-xl bg-app/60 p-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-lg font-semibold">{sub?.planName ?? "ยังไม่มีแพ็กเกจ"}</span>
          {org.trial.onTrial && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">ทดลองใช้</span>
          )}
          {sub?.status === "cancelled" && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">ยกเลิกแล้ว</span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {sub?.endsAt ? (
            <>
              หมดอายุ {fmtDate(sub.endsAt)}
              {days != null && (
                <span className={days < 0 ? "text-rose-600" : days < 7 ? "text-amber-700" : "text-emerald-600"}>
                  {" "}
                  · {days < 0 ? `เลยมา ${Math.abs(days)} วัน` : `เหลือ ${days} วัน`}
                </span>
              )}
            </>
          ) : (
            "ไม่มีวันหมดอายุ"
          )}
        </p>
      </section>

      {note && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          {note}
        </p>
      )}

      {/* --- Renew --- */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">ต่ออายุ</h3>
        <div className="flex flex-wrap gap-2">
          {RENEW_MONTHS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMonths(m)}
              aria-pressed={months === m}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 transition ${
                months === m ? "bg-brand text-brand-foreground ring-brand" : "ring-black/10 hover:bg-app"
              }`}
            >
              {m} เดือน
            </button>
          ))}
        </div>

        {total != null && (
          <p className="text-sm text-muted-foreground">
            ฿{fmt.format(Math.round(perMonth ?? 0))} × {months} ={" "}
            <span className="font-semibold text-foreground">฿{fmt.format(Math.round(total))}</span>
          </p>
        )}

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={markPaid}
            onChange={(e) => setMarkPaid(e.target.checked)}
            className="mt-0.5 size-4 rounded border-input"
          />
          <span>
            รับเงินแล้ว — ต่ออายุทันที
            <span className="block text-xs text-muted-foreground">
              ออกใบแจ้งหนี้และใบเสร็จให้เหมือนเดิม แค่ปิดในขั้นตอนเดียว สำหรับเงินที่โอนมาก่อนแล้ว
            </span>
          </span>
        </label>

        <Button type="button" onClick={() => renewM.mutate()} disabled={renewM.isPending || !sub}>
          {renewM.isPending ? "กำลังดำเนินการ..." : markPaid ? `ต่ออายุ ${months} เดือน` : `ออกใบแจ้งหนี้ ${months} เดือน`}
        </Button>
        {!sub && <p className="text-xs text-muted-foreground">เลือกแพ็กเกจให้สนามนี้ก่อนจึงจะต่ออายุได้</p>}
      </section>

      {/* --- Change plan --- */}
      <section className="space-y-2 border-t border-black/5 pt-4">
        <h3 className="text-sm font-semibold">เปลี่ยนแพ็กเกจ</h3>
        <p className="text-xs text-muted-foreground">มีผลทันทีทั้งขึ้นและลง · วันหมดอายุเดิมไม่เปลี่ยน</p>
        <div className="flex flex-wrap gap-2">
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="h-9 min-w-44 flex-1 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
          >
            <option value="">— เลือกแพ็กเกจ —</option>
            {(plans.data ?? []).map((p) => (
              <option key={p.id} value={p.id} disabled={p.id === sub?.planId}>
                {p.name} (฿{fmt.format(p.price)}){p.id === sub?.planId ? " · ใช้อยู่" : ""}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={() => planM.mutate()} disabled={!planId || planM.isPending}>
            {planM.isPending ? "กำลังบันทึก..." : "เปลี่ยน"}
          </Button>
        </div>
      </section>

      {/* --- Trial --- */}
      <section className="space-y-2 border-t border-black/5 pt-4">
        <h3 className="text-sm font-semibold">ทดลองใช้</h3>
        <p className="text-xs text-muted-foreground">
          ใช้ได้เต็มแพ็กเกจจนครบกำหนด แล้วล็อกเองเหมือนแพ็กเกจหมดอายุ · เมื่อชำระเงินครั้งแรกจะถือว่าจบการทดลอง
        </p>
        <div className="flex flex-wrap gap-2">
          <select
            value={trialPlanId}
            onChange={(e) => setTrialPlanId(e.target.value)}
            className="h-9 min-w-40 flex-1 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
          >
            <option value="">— เลือกแพ็กเกจ —</option>
            {(plans.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={trialDays}
            onChange={(e) => setTrialDays(Number(e.target.value))}
            className="h-9 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
          >
            {TRIAL_DAYS.map((d) => (
              <option key={d} value={d}>
                {d} วัน
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={() => trialM.mutate()} disabled={!trialPlanId || trialM.isPending}>
            {trialM.isPending ? "กำลังเริ่ม..." : "เริ่มทดลอง"}
          </Button>
        </div>
      </section>

      {/* --- The escape hatch, deliberately last and deliberately plain. --- */}
      <section className="border-t border-black/5 pt-4">
        {showExpiry ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">แก้วันหมดอายุด้วยมือ</h3>
            <p className="text-xs text-muted-foreground">
              ไม่มีการออกใบแจ้งหนี้และไม่มีเงินเข้าระบบ จึงต้องระบุเหตุผล — และจะถูกบันทึกไว้ในประวัติการจัดการ
            </p>
            <input
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
            />
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เหตุผล เช่น ชดเชยระบบล่ม / ตกลงกันทางโทรศัพท์"
              maxLength={200}
              className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => expiryM.mutate()}
                disabled={!endsAt || !reason.trim() || expiryM.isPending}
              >
                {expiryM.isPending ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowExpiry(false)}>
                ยกเลิก
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowExpiry(true)}
            disabled={!sub}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
          >
            แก้วันหมดอายุด้วยมือ
          </button>
        )}
      </section>
    </div>
  );
}

/**
 * What has been done to this venue, and by whom.
 *
 * Nothing in the codebase wrote an audit entry until now, so this page showed
 * the same six seeded rows to everyone. The entries that matter are the ones
 * where a platform admin reached into somebody else's business: suspending it,
 * moving it between packages, extending it for free, logging in as its owner.
 */
function HistoryTab({ slug }: { slug: string }) {
  const logs = useQuery({
    queryKey: ["admin", "audit-logs", slug],
    queryFn: () => superAdminApi.getAuditLogs(slug),
  });

  if (logs.isLoading) return <Loading />;
  if (logs.isError) return <ErrorState onRetry={() => logs.refetch()} />;

  const rows = logs.data ?? [];

  if (rows.length === 0) {
    return (
      <div className="grid place-items-center rounded-xl bg-app/50 py-12 text-center text-sm text-muted-foreground">
        ยังไม่มีการจัดการสนามนี้จากฝั่งแอดมิน
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {rows.map((log) => (
        <li key={log.id} className="border-l-2 border-brand/30 pl-3">
          <div className="text-sm font-medium">{log.action}</div>
          {log.detail && <div className="text-sm text-muted-foreground">{log.detail}</div>}
          <div className="mt-0.5 text-xs text-muted-foreground">
            {log.userName}
            {log.createdAt && ` · ${new Date(log.createdAt).toLocaleString("th-TH")}`}
            {log.ipAddress && ` · ${log.ipAddress}`}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function OrgDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>("ข้อมูลทั่วไป");
  const [showPlans, setShowPlans] = useState(false);
  const [planId, setPlanId] = useState("");
  const [confirmImp, setConfirmImp] = useState(false);
  // Built from the live origin, which differs between local and prod. Same URL
  // the venue gives its customers.
  const origin = useOrigin();

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

                <CustomerLink
                  slug={data.id}
                  hint="ลิงก์หน้าจองของสนามนี้ — คัดลอกส่งให้สนาม/ลูกค้าได้เลย"
                  className="ring-black/10"
                />

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
                    <button type="button" onClick={() => setTab("การสมัครใช้งาน")} className="mt-3 w-full rounded-lg border border-brand py-2 text-sm font-semibold text-brand hover:bg-brand/10">
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
                    <button type="button" onClick={() => setTab("ประวัติ")} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-black/10 hover:bg-app">
                      <History className="size-4" /> ดูประวัติการจัดการ
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
                    {data.id && origin ? customerLinkFor(data.id, origin) : " "}
                  </code>
                  <p className="mt-1.5 text-muted-foreground">
                    ตั้งค่านี้เป็น <b>LIFF Endpoint URL</b> ใน LINE Developers console ของสนาม (ต้องตรงกัน)
                    — เป็นลิงก์เดียวกับที่ส่งให้ลูกค้า
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
            ) : tab === "การสมัครใช้งาน" ? (
              <SubscriptionTab org={data} onDone={invalidate} />
            ) : (
              <HistoryTab slug={data.id} />
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
