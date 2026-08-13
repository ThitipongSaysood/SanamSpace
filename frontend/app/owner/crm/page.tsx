"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CreditCard,
  Gift,
  Megaphone,
  Plus,
  Send,
  Sparkles,
  Star,
  Tag as TagIcon,
  Trash2,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type {
  OwnerBroadcast,
  OwnerBroadcastChannel,
  OwnerCrmOverview,
  OwnerSegment,
  OwnerTimelineEntry,
  SegmentCriteria,
} from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMessages, useLocale } from "@/lib/i18n/context";
import { fmt as interp, intlLocale } from "@/lib/i18n/format";

const fmt = new Intl.NumberFormat("th-TH");

const OVERVIEW_KEY = ["owner", "crm", "overview"];
const SEGMENTS_KEY = ["owner", "segments"];
const BROADCASTS_KEY = ["owner", "broadcasts"];

type TabId = "overview" | "segments" | "broadcasts" | "timeline";
const TAB_IDS: TabId[] = ["overview", "segments", "broadcasts", "timeline"];

export default function OwnerCrmPage() {
  const tc = useMessages("owner").crm;
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">CRM</h1>
        <p className="text-sm text-muted-foreground">{tc.subtitle}</p>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={tc.tabsAria}>
        {TAB_IDS.map((id) => {
          const active = id === tab;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-brand text-brand-foreground"
                  : "bg-white text-foreground ring-1 ring-black/5"
              }`}
            >
              {tc.tab[id]}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "segments" && <SegmentsTab />}
      {tab === "broadcasts" && <BroadcastsTab />}
      {tab === "timeline" && <TimelineTab />}
    </div>
  );
}

/* ------------------------------- Overview ------------------------------- */

function OverviewTab() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: OVERVIEW_KEY,
    queryFn: ownerApi.getCrmOverview,
  });

  if (isLoading) return <Loading rows={2} />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!data) return null;
  return <OverviewBody d={data} />;
}

function OverviewBody({ d }: { d: OwnerCrmOverview }) {
  const t = useMessages("owner").crm;
  const stats: { label: string; value: number; icon: LucideIcon; tint: string }[] = [
    { label: t.statTotal, value: d.totalCustomers, icon: Users, tint: "bg-brand/10 text-brand" },
    { label: t.statNew30, value: d.newCustomers30d, icon: UserPlus, tint: "bg-sky-100 text-sky-600" },
    { label: t.statInactive30, value: d.inactive30d, icon: CalendarClock, tint: "bg-amber-100 text-amber-600" },
    { label: t.statVip, value: d.vipCount, icon: Star, tint: "bg-violet-100 text-violet-700" },
  ];

  const dist = d.segmentDistribution ?? [];
  const max = dist.reduce((m, s) => Math.max(m, s.count), 0) || 1;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <span className={`grid size-10 place-items-center rounded-xl ${s.tint}`}>
              <s.icon className="size-5" />
            </span>
            <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums">
              {fmt.format(s.value)}
            </div>
            <div className="mt-0.5 text-sm text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-3 text-sm font-semibold">{t.distTitle}</h2>
        {dist.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t.distEmpty}</p>
        ) : (
          <ul className="space-y-3">
            {dist.map((s) => (
              <li key={s.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{s.name}</span>
                  <span className="tabular-nums text-muted-foreground">{fmt.format(s.count)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-app">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.round((s.count / max) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RfmPanel />
    </div>
  );
}

/** RFM group names, in the order a venue would work through them. */
const RFM_LABELS: { key: string; tint: string }[] = [
  { key: "champions", tint: "bg-emerald-100 text-emerald-700" },
  { key: "loyal", tint: "bg-brand/10 text-brand" },
  { key: "promising", tint: "bg-sky-100 text-sky-700" },
  { key: "new", tint: "bg-blue-100 text-blue-700" },
  { key: "needs_attention", tint: "bg-amber-100 text-amber-700" },
  { key: "at_risk", tint: "bg-orange-100 text-orange-700" },
  { key: "lost", tint: "bg-rose-100 text-rose-700" },
  { key: "never_booked", tint: "bg-slate-100 text-slate-600" },
];

/**
 * Customers sorted by how they actually behave, with names attached.
 *
 * A distribution on its own is a chart nobody acts on, so the two groups worth
 * doing something about come with the people in them.
 */
function RfmPanel() {
  const t = useMessages("owner").crm;
  const { data } = useQuery({ queryKey: ["owner", "crm", "rfm"], queryFn: ownerApi.getRfm });

  if (!data || data.total === 0) return null;

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <h2 className="text-sm font-semibold">{t.rfmTitle}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {t.rfmHint}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {RFM_LABELS.filter((l) => data.groups[l.key]).map((l) => (
          <span key={l.key} className={`rounded-full px-3 py-1 text-sm font-medium ${l.tint}`}>
            {(t.rfm as Record<string, string>)[l.key]} {fmt.format(data.groups[l.key])}
          </span>
        ))}
      </div>

      {data.atRisk.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-orange-700">{t.atRiskTitle}</h3>
          <ul className="mt-1.5 divide-y divide-black/5 rounded-xl bg-app">
            {data.atRisk.slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{c.name ?? t.custFallback}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {c.lastSeenDays === null ? t.neverBooked : interp(t.notSeenDays, { n: fmt.format(c.lastSeenDays) })} · ฿{fmt.format(c.spend)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ------------------------------- Segments ------------------------------- */

function SegmentsTab() {
  const t = useMessages("owner").crm;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: SEGMENTS_KEY,
    queryFn: ownerApi.getSegments,
  });
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {!adding && (
          <Button type="button" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> {t.addSegment}
          </Button>
        )}
      </div>

      {adding && <SegmentForm onClose={() => setAdding(false)} />}

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && !adding && <EmptyState message={t.noSegments} />}

      {data && data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((s) => (
            <SegmentCard key={s.id} segment={s} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The rules a dynamic segment is built from.
 *
 * Presets rather than a free rule builder: these are the questions venues
 * actually ask, and each one is a criterion the backend already understands.
 * "Choose your own" stays available underneath.
 */
const PRESETS: { id: string; criteria: SegmentCriteria }[] = [
  { id: "regulars", criteria: { minBookings: 5 } },
  { id: "lapsed", criteria: { notBookedForDays: 60 } },
  { id: "new", criteria: { joinedWithinDays: 30 } },
  { id: "one_time", criteria: { maxBookings: 1, minBookings: 1 } },
  { id: "big_spender", criteria: { minSpend: 5000 } },
  { id: "at_risk", criteria: { rfmLabel: ["at_risk"] } },
];

function SegmentForm({ onClose }: { onClose: () => void }) {
  const t = useMessages("owner").crm;
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", description: "" });
  const [preset, setPreset] = useState<string | null>(null);

  const criteria = PRESETS.find((p) => p.id === preset)?.criteria;

  const mutation = useMutation({
    mutationFn: () => ownerApi.createSegment({ ...form, ...(criteria ? { criteria } : {}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SEGMENTS_KEY });
      qc.invalidateQueries({ queryKey: OVERVIEW_KEY });
      onClose();
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    mutation.mutate();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t.addSegment}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-app"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="seg-name">{t.segNameLabel}</Label>
        <Input
          id="seg-name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder={t.segNamePlaceholder}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="seg-desc">{t.segDescLabel}</Label>
        <Input
          id="seg-desc"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder={t.segDescPlaceholder}
        />
      </div>

      <div className="space-y-1.5">
        <Label>{t.criteriaLabel}</Label>
        <p className="text-xs text-muted-foreground">
          {t.criteriaHint}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PRESETS.map((p) => {
            const on = preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => setPreset(on ? null : p.id)}
                className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                  on ? "border-brand bg-brand/5" : "border-black/10 hover:bg-app"
                }`}
              >
                <div className="font-medium">{(t.presetLabel as Record<string, string>)[p.id]}</div>
                <div className="text-xs text-muted-foreground">{(t.presetHint as Record<string, string>)[p.id]}</div>
              </button>
            );
          })}
        </div>
      </div>

      {mutation.isError && (
        <p className="text-sm text-brand-danger">{t.saveFailed}</p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={mutation.isPending || !form.name.trim()}>
          {mutation.isPending ? t.saving : t.save}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}

function SegmentCard({ segment }: { segment: OwnerSegment }) {
  const t = useMessages("owner").crm;
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => ownerApi.deleteSegment(segment.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SEGMENTS_KEY });
      qc.invalidateQueries({ queryKey: OVERVIEW_KEY });
    },
  });

  function onDelete() {
    if (window.confirm(interp(t.deleteSegConfirm, { name: segment.name }))) del.mutate();
  }

  return (
    <div className="flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
          <TagIcon className="size-5" />
        </span>
        <span className="rounded-full bg-app px-2.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-black/5">
          {interp(t.memberCount, { n: fmt.format(segment.memberCount) })}
        </span>
      </div>

      <div className="mt-3 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold">{segment.name}</span>
          {/* Said out loud: a member count nobody can edit reads as a bug
              unless the segment says it maintains itself. */}
          {segment.dynamic && (
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
              {t.autoUpdate}
            </span>
          )}
        </div>
        {segment.description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{segment.description}</p>
        )}
      </div>

      {del.isError && <p className="mt-2 text-sm text-brand-danger">{t.deleteFailed}</p>}

      <div className="mt-3 flex items-center gap-2 border-t border-black/5 pt-3">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={del.isPending}
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" /> {del.isPending ? t.deleting : t.delete}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------ Broadcasts ------------------------------ */

const CHANNELS: { value: OwnerBroadcastChannel; label: string }[] = [
  { value: "line", label: "LINE" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "push", label: "Push" },
];

function channelLabel(c: string) {
  return CHANNELS.find((x) => x.value === c)?.label ?? c;
}

function fmtDateTime(s: string | null, locale: Parameters<typeof intlLocale>[0]) {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString(intlLocale(locale));
}

function BroadcastsTab() {
  const t = useMessages("owner").crm;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: BROADCASTS_KEY,
    queryFn: ownerApi.getBroadcasts,
  });
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {!adding && (
          <Button type="button" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> {t.addBroadcast}
          </Button>
        )}
      </div>

      {adding && <BroadcastForm onClose={() => setAdding(false)} />}

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && !adding && <EmptyState message={t.noBroadcasts} />}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((b) => (
            <BroadcastCard key={b.id} broadcast={b} />
          ))}
        </div>
      )}
    </div>
  );
}

function BroadcastForm({ onClose }: { onClose: () => void }) {
  const t = useMessages("owner").crm;
  const qc = useQueryClient();
  const segments = useQuery({ queryKey: SEGMENTS_KEY, queryFn: ownerApi.getSegments });
  const [form, setForm] = useState<{
    title: string;
    message: string;
    channel: OwnerBroadcastChannel;
    segmentId: string;
  }>({ title: "", message: "", channel: "line", segmentId: "" });

  const mutation = useMutation({
    mutationFn: () =>
      ownerApi.createBroadcast({
        title: form.title,
        message: form.message,
        channel: form.channel,
        segmentId: form.segmentId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BROADCASTS_KEY });
      onClose();
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return;
    mutation.mutate();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t.addBroadcast}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-app"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bc-title">{t.bcTitleLabel}</Label>
        <Input
          id="bc-title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder={t.bcTitlePlaceholder}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bc-message">{t.bcMessageLabel}</Label>
        <textarea
          id="bc-message"
          value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          placeholder={t.bcMessagePlaceholder}
          rows={3}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bc-channel">{t.channelLabel}</Label>
          <select
            id="bc-channel"
            value={form.channel}
            onChange={(e) =>
              setForm((f) => ({ ...f, channel: e.target.value as OwnerBroadcastChannel }))
            }
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bc-segment">{t.segmentLabel}</Label>
          <select
            id="bc-segment"
            value={form.segmentId}
            onChange={(e) => setForm((f) => ({ ...f, segmentId: e.target.value }))}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">{t.allCustomers}</option>
            {(segments.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {mutation.isError && (
        <p className="text-sm text-brand-danger">{t.saveFailed}</p>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          disabled={mutation.isPending || !form.title.trim() || !form.message.trim()}
        >
          {mutation.isPending ? t.saving : t.save}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}

function BroadcastStatus({ status }: { status: OwnerBroadcast["status"] }) {
  const t = useMessages("owner").crm;
  const m =
    status === "sent"
      ? { label: t.statusSent, cls: "bg-brand/10 text-brand" }
      : { label: t.statusDraft, cls: "bg-amber-100 text-amber-700" };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}

function BroadcastCard({ broadcast }: { broadcast: OwnerBroadcast }) {
  const t = useMessages("owner").crm;
  const { locale } = useLocale();
  const qc = useQueryClient();
  const send = useMutation({
    mutationFn: () => ownerApi.sendBroadcast(broadcast.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: BROADCASTS_KEY }),
  });

  function onSend() {
    if (window.confirm(interp(t.sendConfirm, { title: broadcast.title }))) send.mutate();
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
            <Megaphone className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-semibold">{broadcast.title}</div>
            <div className="truncate text-sm text-muted-foreground">{broadcast.message}</div>
          </div>
        </div>
        <BroadcastStatus status={broadcast.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-app px-2.5 py-0.5 font-medium ring-1 ring-black/5">
          {channelLabel(broadcast.channel)}
        </span>
        {broadcast.segmentName && (
          <span className="rounded-full bg-app px-2.5 py-0.5 font-medium ring-1 ring-black/5">
            {broadcast.segmentName}
          </span>
        )}
        <span className="tabular-nums">{interp(t.recipients, { n: fmt.format(broadcast.recipientCount) })}</span>
        {broadcast.status === "sent" && <span>{interp(t.sentAt, { date: fmtDateTime(broadcast.sentAt, locale) })}</span>}
      </div>

      {send.isError && <p className="mt-2 text-sm text-brand-danger">{t.sendFailed}</p>}

      {broadcast.status === "draft" && (
        <div className="mt-3 flex items-center gap-2 border-t border-black/5 pt-3">
          <Button type="button" size="sm" disabled={send.isPending} onClick={onSend}>
            <Send className="size-3.5" /> {send.isPending ? t.sending : t.send}
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Timeline ------------------------------- */

const TIMELINE_ICONS: Record<string, LucideIcon> = {
  booking: CalendarClock,
  payment: CreditCard,
  points: Sparkles,
  reward: Gift,
  membership: Star,
};

function timelineIcon(type: string): LucideIcon {
  return TIMELINE_ICONS[type] ?? Sparkles;
}

function TimelineTab() {
  const t = useMessages("owner").crm;
  const customers = useQuery({ queryKey: ["owner", "customers"], queryFn: ownerApi.getCustomers });
  const [customerId, setCustomerId] = useState("");

  const timeline = useQuery({
    queryKey: ["owner", "timeline", customerId],
    queryFn: () => ownerApi.getTimeline(customerId),
    enabled: !!customerId,
  });

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <Label htmlFor="tl-customer">{t.pickCustomer}</Label>
        <select
          id="tl-customer"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          disabled={customers.isLoading || customers.isError}
          className="mt-1.5 h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <option value="">{t.pickCustomerOpt}</option>
          {(customers.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
            </option>
          ))}
        </select>
        {customers.isError && (
          <p className="mt-2 text-sm text-brand-danger">{t.loadCustomersFailed}</p>
        )}
      </section>

      {!customerId && <EmptyState message={t.selectToView} />}

      {customerId && timeline.isLoading && <Loading rows={2} />}
      {customerId && timeline.isError && <ErrorState onRetry={() => timeline.refetch()} />}
      {customerId && timeline.data && timeline.data.length === 0 && (
        <EmptyState message={t.noActivity} />
      )}
      {customerId && timeline.data && timeline.data.length > 0 && (
        <TimelineList entries={timeline.data} />
      )}
    </div>
  );
}

function TimelineList({ entries }: { entries: OwnerTimelineEntry[] }) {
  const { locale } = useLocale();
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <ul className="space-y-1">
        {entries.map((e, i) => {
          const Icon = timelineIcon(e.type);
          const last = i === entries.length - 1;
          return (
            <li key={e.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                  <Icon className="size-4" />
                </span>
                {!last && <span className="my-1 w-px flex-1 bg-black/10" />}
              </div>
              <div className={`min-w-0 flex-1 ${last ? "" : "pb-4"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{e.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {fmtDateTime(e.occurredAt, locale)}
                  </span>
                </div>
                {e.description && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{e.description}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
