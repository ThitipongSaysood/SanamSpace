"use client";
import { toast } from "@/lib/toast";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BatteryFull,
  Bell,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Info,
  MessageCircle,
  Pencil,
  Search,
  Send,
  ShieldCheck,
  Signal,
  Smartphone,
  Trash2,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import type {
  OwnerBroadcast,
  OwnerBroadcastAudience,
  OwnerBroadcastChannel,
  OwnerBroadcastDelivery,
} from "@/lib/types";
import { ownerApi, OwnerApiError } from "@/lib/api/owner";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMessages, useLocale } from "@/lib/i18n/context";
import { fmt as interp, intlLocale } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/config";

const fmt = new Intl.NumberFormat("th-TH");
const BROADCASTS_KEY = ["owner", "broadcasts"];
const SEGMENTS_KEY = ["owner", "segments"];

type AudienceOption = {
  value: OwnerBroadcastAudience;
  label: string;
  hint: string;
  needsDays?: boolean;
  needsSegment?: boolean;
};

const AUDIENCES: AudienceOption[] = [
  { value: "lost", label: "", hint: "", needsDays: true },
  { value: "regulars", label: "", hint: "" },
  { value: "one_time", label: "", hint: "" },
  { value: "new", label: "", hint: "", needsDays: true },
  { value: "all", label: "", hint: "" },
  { value: "segment", label: "", hint: "", needsSegment: true },
];

type Template = { id: string; label: string; title: string; message: string };
const TEMPLATES: Template[] = [
  { id: "winback", label: "", title: "คิดถึงคุณ! 🏸", message: "ไม่ได้เจอกันนานเลย กลับมาเล่นกันไหม 💚 รับส่วนลด 20% เมื่อจองภายในสัปดาห์นี้ แล้วเจอกันที่สนามนะ!" },
  { id: "regular", label: "", title: "ขอบคุณที่อยู่กับเราเสมอ 💚", message: "สิทธิพิเศษสำหรับลูกค้าคนสำคัญ รับส่วนลด 15% ทุกการจองตลอดเดือนนี้ 🎉" },
  { id: "onetime", label: "", title: "ครั้งแรกเป็นไงบ้าง? 😊", message: "หวังว่าจะสนุกกันนะ! จองครั้งต่อไปรับส่วนลดพิเศษ 10% รอคุณกลับมาอยู่นะ" },
  { id: "welcome", label: "", title: "ยินดีต้อนรับ! 🎉", message: "ขอบคุณที่สมัครสมาชิก รับส่วนลด 10% สำหรับการจองครั้งแรกของคุณเลย" },
  { id: "promo", label: "", title: "โปรโมชั่นพิเศษ 🔥", message: "จองวันนี้รับส่วนลดทันที! ดูรายละเอียดและจองได้เลยในแอป" },
];

type ChannelMeta = { value: OwnerBroadcastChannel; label: string; sub: string; icon: typeof Send };
const CHANNELS: ChannelMeta[] = [
  { value: "line", label: "", sub: "", icon: MessageCircle },
  { value: "app", label: "", sub: "", icon: Smartphone },
];

const STEP_COUNT = 3;

function channelLabel(c: OwnerBroadcastChannel, t: Messages["owner"]["broadcast"]): string {
  return c === "line" ? "LINE" : c === "app" ? t.chApp : c;
}

function fmtDateTime(iso: string | null, locale: Locale): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(intlLocale(locale), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Load, cap the largest side to maxDim, and re-encode as JPEG so uploads are
// small and always in a format the API accepts. Rejects with a clear message
// when the browser can't decode the file (e.g. HEIC).
async function downscaleImage(file: File, maxDim = 1600, quality = 0.85): Promise<File> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("รูปแบบไฟล์นี้ไม่รองรับ — กรุณาใช้ JPG หรือ PNG"));
    i.src = dataUrl;
  });
  let { width, height } = img;
  const longest = Math.max(width, height);
  if (longest > maxDim) {
    const s = maxDim / longest;
    width = Math.round(width * s);
    height = Math.round(height * s);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("แปลงรูปไม่สำเร็จ");
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("แปลงรูปไม่สำเร็จ");
  return new File([blob], "banner.jpg", { type: "image/jpeg" });
}

export default function BroadcastPage() {
  const tp = useMessages("owner").broadcast;
  const qc = useQueryClient();
  const segments = useQuery({ queryKey: SEGMENTS_KEY, queryFn: ownerApi.getSegments });
  const list = useQuery({ queryKey: BROADCASTS_KEY, queryFn: ownerApi.getBroadcasts });

  const [step, setStep] = useState(0);
  const [channel, setChannel] = useState<OwnerBroadcastChannel>("line");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [audience, setAudience] = useState<OwnerBroadcastAudience>("lost");
  const [days, setDays] = useState(30);
  const [segmentId, setSegmentId] = useState("");
  const [result, setResult] = useState<{ recipientCount: number; delivery: OwnerBroadcastDelivery } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OwnerBroadcast | null>(null);

  const opt = useMemo(() => AUDIENCES.find((a) => a.value === audience)!, [audience]);
  const isLine = channel === "line";
  const composeValid = title.trim().length > 0 && message.trim().length > 0;

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = TEMPLATES.find((x) => x.id === id);
    if (t) { setTitle(t.title); setMessage(t.message); }
  }

  async function onPickBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setUploading(true);
    try {
      // Normalise to a modest JPEG in the browser first — sidesteps oversized
      // photos and formats the server won't accept (e.g. iPhone HEIC).
      const prepared = await downscaleImage(file);
      const url = await ownerApi.uploadImage(prepared);
      setBannerUrl(url);
    } catch (err) {
      const msg =
        err instanceof OwnerApiError
          ? interp(tp.uploadFailedStatus, { status: err.status, msg: err.message })
          : err instanceof Error
            ? err.message
            : tp.uploadFailedGeneric;
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  const preview = useQuery({
    queryKey: ["owner", "audience-preview", audience, days, segmentId],
    queryFn: () => ownerApi.previewAudience({
      audience,
      inactiveDays: opt.needsDays ? days : undefined,
      segmentId: opt.needsSegment ? segmentId || undefined : undefined,
    }),
    enabled: !opt.needsSegment || Boolean(segmentId),
  });

  const deliverableCount = isLine ? preview.data?.reachableCount ?? 0 : preview.data?.recipientCount ?? 0;
  const canSend = composeValid && (!opt.needsSegment || Boolean(segmentId)) && deliverableCount > 0;

  function buildBody() {
    return {
      title: title.trim(),
      message: message.trim(),
      channel,
      imageUrl: bannerUrl ?? undefined,
      audience,
      inactiveDays: opt.needsDays ? days : undefined,
      segmentId: opt.needsSegment ? segmentId || undefined : undefined,
    };
  }

  const send = useMutation({
    mutationFn: async () => {
      const created = await ownerApi.createBroadcast(buildBody());
      return ownerApi.sendBroadcast(created.id);
    },
    onSuccess: (b) => {
      setResult({ recipientCount: b.recipientCount, delivery: b.delivery ?? { sent: 0, failed: 0, skipped: 0, noToken: false } });
      qc.invalidateQueries({ queryKey: BROADCASTS_KEY });
      setTitle("");
      setMessage("");
      setBannerUrl(null);
      setTemplateId("");
    },
  });

  // Save without sending (a draft you can edit / send later from the history).
  const saveDraft = useMutation({
    mutationFn: () => ownerApi.createBroadcast(buildBody()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BROADCASTS_KEY });
      reset();
    },
  });

  // Save edits to an existing draft.
  const saveEdit = useMutation({
    mutationFn: () => ownerApi.updateBroadcast(editingId!, buildBody()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BROADCASTS_KEY });
      reset();
    },
  });

  // History-row actions (operate on `detail`).
  const del = useMutation({
    mutationFn: (id: string) => ownerApi.deleteBroadcast(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BROADCASTS_KEY });
      setDetail(null);
    },
  });
  const sendExisting = useMutation({
    mutationFn: (id: string) => ownerApi.sendBroadcast(id),
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: BROADCASTS_KEY });
      setDetail(null);
      setResult({ recipientCount: b.recipientCount, delivery: b.delivery ?? { sent: 0, failed: 0, skipped: 0, noToken: false } });
    },
  });

  // Load a draft back into the wizard to edit it.
  function editDraft(b: OwnerBroadcast) {
    setDetail(null);
    setResult(null);
    setEditingId(b.id);
    setChannel(b.channel === "line" || b.channel === "app" ? b.channel : "line");
    setTitle(b.title);
    setMessage(b.message);
    setBannerUrl(b.imageUrl);
    setTemplateId("");
    setAudience(b.audience);
    setDays(b.inactiveDays ?? 30);
    setSegmentId(b.segmentId ?? "");
    setStep(1);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onSend() {
    setResult(null);
    const via = isLine ? tp.viaLine : tp.viaApp;
    if (window.confirm(interp(tp.confirmSendVia, { via, aud: tp.audienceLabel[audience], n: fmt.format(deliverableCount) }))) send.mutate();
  }

  function goTo(target: number) {
    if (target <= step || target === 1 || (target === 2 && composeValid)) setStep(target);
  }

  // Start a brand-new blast after one is sent.
  function reset() {
    setResult(null);
    setEditingId(null);
    setStep(0);
    setChannel("line");
    setTitle("");
    setMessage("");
    setBannerUrl(null);
    setTemplateId("");
    setAudience("lost");
    setDays(30);
    setSegmentId("");
  }

  const phone = (
    <PhoneFrame>
      {isLine
        ? <LineChatPreview title={title} message={message} imageUrl={bannerUrl} />
        : <AppNotificationPreview title={title} message={message} imageUrl={bannerUrl} />}
    </PhoneFrame>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-lg font-semibold">{tp.title}</h1>
        <p className="text-sm text-muted-foreground">{tp.subtitle}</p>
      </header>

      {editingId && !result && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-200">
          <span>{tp.editingDraft}</span>
          <button type="button" onClick={reset} className="font-medium underline">{tp.cancel}</button>
        </div>
      )}

      {result ? (
        <SuccessPanel result={result} isLine={isLine} onNew={reset} />
      ) : (
        <>
      <Stepper step={step} onSelect={goTo} />

      <SummaryBar
        channel={channel}
        audienceLabel={tp.audienceLabel[audience]}
        reach={preview.data ? deliverableCount : null}
        reachKind={isLine ? "line" : "app"}
      />

      {/* Step 1 — channel */}
      {step === 0 && (
        <Card key="step0" className={STEP_ANIM}>
          <SectionHead title={tp.chooseChannel} hint={tp.chooseChannelHint} />
          <div className="grid gap-3 sm:grid-cols-2">
            {CHANNELS.map((c) => (
              <ChannelChoice key={c.value} meta={c} active={channel === c.value} onClick={() => setChannel(c.value)} />
            ))}
          </div>
          <StepNav onNext={() => setStep(1)} />
        </Card>
      )}

      {/* Step 2 — message */}
      {step === 1 && (
        <TwoCol key="step1" phone={phone} className={STEP_ANIM}>
          <Card>
            <div className="space-y-1.5">
              <Label htmlFor="bc-template">{tp.templateLabelField}</Label>
              <Select id="bc-template" value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">{tp.writeOwn}</option>
                {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{tp.templateLabel[t.id as keyof typeof tp.templateLabel]}</option>)}
              </Select>
              <p className="text-xs text-muted-foreground">{tp.templateHint}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bc-title">{tp.titleLabel}</Label>
              <Input id="bc-title" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder={tp.titlePlaceholder} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bc-message">{tp.messageLabel}</Label>
              <textarea id="bc-message" value={message} onChange={(e) => setMessage(e.target.value)}
                placeholder={tp.messagePlaceholder} rows={4}
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
            </div>

            <div className="space-y-1.5">
              <Label>{tp.bannerLabel}</Label>
              {bannerUrl ? (
                <div className="relative w-fit">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bannerUrl} alt={tp.bannerAlt} className="max-h-40 rounded-lg ring-1 ring-black/10" />
                  <button type="button" onClick={() => setBannerUrl(null)} aria-label={tp.removeImage}
                    className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-neutral-900 text-white shadow">
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input px-3 py-2 text-sm text-muted-foreground hover:bg-app">
                  <ImagePlus className="size-4" />
                  {uploading ? tp.uploading : tp.addBanner}
                  <input type="file" accept="image/*" className="hidden"
                    disabled={uploading} onChange={onPickBanner} />
                </label>
              )}
              <p className="text-xs text-muted-foreground">{tp.bannerHint}</p>
            </div>

            <StepNav onBack={() => setStep(0)} onNext={() => setStep(2)} nextDisabled={!composeValid} />
          </Card>
        </TwoCol>
      )}

      {/* Step 3 — audience + send */}
      {step === 2 && (
        <TwoCol key="step2" phone={phone} className={STEP_ANIM}>
          <Card>
            <SectionHead title={tp.audienceTitle} hint={tp.audienceHint[audience]} />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AUDIENCES.map((a) => (
                <button key={a.value} type="button" onClick={() => setAudience(a.value)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                    audience === a.value ? "border-brand bg-brand/5 font-medium text-brand" : "border-input hover:bg-app"
                  }`}>
                  {tp.audienceLabel[a.value]}
                </button>
              ))}
            </div>

            {opt.needsDays && (
              <div className="space-y-1.5">
                <Label htmlFor="bc-days">{audience === "lost" ? tp.lostDaysLabel : tp.newDaysLabel}</Label>
                <Input id="bc-days" type="number" min={1} max={3650} value={days}
                  onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} className="w-32" />
              </div>
            )}

            {opt.needsSegment && (
              <div className="space-y-1.5">
                <Label htmlFor="bc-segment">{tp.pickSegment}</Label>
                <Select id="bc-segment" value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
                  <option value="">{tp.pickSegmentOpt}</option>
                  {(segments.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
            )}

            {/* Said out loud, so a shrinking audience reads as the law working
                rather than as a broken filter. */}
            {(preview.data?.suppressedCount ?? 0) > 0 && (
              <p className="inline-flex items-center gap-1.5 rounded-lg bg-app px-3 py-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0" />
                {interp(tp.suppressed, { n: fmt.format(preview.data!.suppressedCount) })}
              </p>
            )}

            {isLine && preview.data && preview.data.reachableCount === 0 && (
              <p className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <WifiOff className="size-4 shrink-0" /> {tp.noLineReach}
              </p>
            )}

            {(send.isError || saveDraft.isError || saveEdit.isError) && (
              <p className="text-sm text-brand-danger">{tp.sendFailed}</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="size-4" /> {tp.back}
              </Button>
              <div className="flex flex-wrap gap-2">
                {editingId ? (
                  <Button type="button" onClick={() => saveEdit.mutate()}
                    disabled={!composeValid || (opt.needsSegment && !segmentId) || saveEdit.isPending}>
                    <Check className="size-4" /> {saveEdit.isPending ? tp.saving : tp.saveEdit}
                  </Button>
                ) : (
                  <>
                    <Button type="button" variant="outline" onClick={() => saveDraft.mutate()}
                      disabled={!composeValid || (opt.needsSegment && !segmentId) || saveDraft.isPending}>
                      {saveDraft.isPending ? tp.saving : tp.saveDraft}
                    </Button>
                    <Button type="button" onClick={onSend} disabled={!canSend || send.isPending}>
                      <Send className="size-4" />{" "}
                      {send.isPending ? tp.sending : isLine ? tp.sendLine : tp.sendApp}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        </TwoCol>
      )}
        </>
      )}

      {/* History */}
      <section className="space-y-3 border-t border-black/5 pt-6">
        <h2 className="text-sm font-semibold">{tp.historyTitle}</h2>
        {list.isLoading && <Loading />}
        {list.isError && <ErrorState onRetry={() => list.refetch()} />}
        {list.data && list.data.length === 0 && <EmptyState message={tp.noHistory} />}
        {list.data && list.data.length > 0 && (
          <div className="space-y-2">
            {list.data.map((b) => (
              <HistoryRow key={b.id} broadcast={b} onOpen={() => setDetail(b)} />
            ))}
          </div>
        )}
      </section>

      {detail && (
        <BroadcastDetail
          broadcast={detail}
          onClose={() => setDetail(null)}
          onEdit={() => editDraft(detail)}
          onDelete={() => {
            if (window.confirm(interp(tp.confirmDelete, { title: detail.title }))) del.mutate(detail.id);
          }}
          onSend={() => {
            if (window.confirm(interp(tp.confirmSend, { title: detail.title }))) sendExisting.mutate(detail.id);
          }}
          deleting={del.isPending}
          sending={sendExisting.isPending}
        />
      )}
    </div>
  );
}

/* --------------------------------- Primitives --------------------------------- */

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`space-y-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 ${className}`}>{children}</section>;
}

const STEP_ANIM = "animate-in fade-in slide-in-from-bottom-3 duration-300 ease-out";

function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Select({ id, value, onChange, children }: {
  id: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode;
}) {
  return (
    <select id={id} value={value} onChange={onChange}
      className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
      {children}
    </select>
  );
}

// Two-column step body: focused form card left, phone preview right on the page
// ground (no card). Columns share height; the phone centers in its column.
function TwoCol({ children, phone, className = "" }: { children: React.ReactNode; phone: React.ReactNode; className?: string }) {
  const tp = useMessages("owner").broadcast;
  return (
    <div className={`grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-stretch ${className}`}>
      {children}
      <div className="flex flex-col items-center justify-center gap-3">
        <span className="text-xs font-medium text-muted-foreground">{tp.mobilePreview}</span>
        {phone}
      </div>
    </div>
  );
}

function StepNav({ onBack, onNext, nextDisabled, nextLabel, nextIcon }: {
  onBack?: () => void; onNext?: () => void; nextDisabled?: boolean; nextLabel?: string; nextIcon?: React.ReactNode;
}) {
  const tp = useMessages("owner").broadcast;
  const label = nextLabel ?? tp.next;
  return (
    <div className="flex items-center justify-between pt-1">
      {onBack ? (
        <Button type="button" variant="outline" onClick={onBack}><ChevronLeft className="size-4" /> {tp.back}</Button>
      ) : <span />}
      <Button type="button" onClick={onNext} disabled={nextDisabled}>
        {nextIcon ?? null} {label} {nextIcon ? null : <ChevronRight className="size-4" />}
      </Button>
    </div>
  );
}

function ChannelChoice({ meta, active, onClick }: { meta: ChannelMeta; active: boolean; onClick: () => void }) {
  const tp = useMessages("owner").broadcast;
  const Icon = meta.icon;
  return (
    <button type="button" onClick={onClick}
      className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
        active ? "border-brand bg-brand/5" : "border-input hover:bg-app"
      }`}>
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${
        active ? "bg-brand text-brand-foreground" : "bg-app text-muted-foreground"
      }`}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className={`block text-sm font-medium ${active ? "text-brand" : ""}`}>{(tp.channelLabelFull as Record<string, string>)[meta.value]}</span>
        <span className="block text-xs text-muted-foreground">{(tp.channelSub as Record<string, string>)[meta.value]}</span>
      </span>
      {active && <Check className="ml-auto size-4 shrink-0 text-brand" />}
    </button>
  );
}

// Full-screen confirmation shown after a blast goes out — unmistakably "done".
function SuccessPanel({
  result,
  isLine,
  onNew,
}: {
  result: { recipientCount: number; delivery: OwnerBroadcastDelivery };
  isLine: boolean;
  onNew: () => void;
}) {
  const tp = useMessages("owner").broadcast;
  const d = result.delivery;
  const noToken = d.noToken;
  return (
    <Card className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300 ease-out">
      <div
        className={`mx-auto grid size-16 place-items-center rounded-full ${
          noToken ? "bg-amber-100 text-amber-600" : "bg-brand/10 text-brand"
        } animate-in zoom-in-50 duration-500 ease-out`}
      >
        {noToken ? <Info className="size-8" /> : <CheckCircle2 className="size-9" />}
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{noToken ? tp.savedNotSent : tp.sentSuccess}</h2>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {noToken ? (
            tp.noTokenMsg
          ) : (
            <>
              {tp.sentPre}<strong className="tabular-nums text-foreground">{fmt.format(d.sent)}</strong>{" "}
              {isLine ? tp.sentViaLine : tp.sentViaApp}{tp.sentPost}
              {d.skipped > 0 && interp(tp.skippedNote, { n: fmt.format(d.skipped) })}
            </>
          )}
        </p>
      </div>

      <Button type="button" onClick={onNew}>
        <Send className="size-4" /> {tp.newBlast}
      </Button>
      <p className="text-xs text-muted-foreground">{tp.inHistory}</p>
    </Card>
  );
}

/* ---------------------------------- Stepper ---------------------------------- */

function Stepper({ step, onSelect }: { step: number; onSelect: (i: number) => void }) {
  const tp = useMessages("owner").broadcast;
  return (
    <div className="flex items-center">
      {tp.steps.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <button type="button" onClick={() => onSelect(i)} className="flex items-center gap-2">
              <span className={`grid size-7 place-items-center rounded-full text-xs font-semibold transition ${
                active ? "bg-brand text-brand-foreground" : done ? "bg-brand/15 text-brand" : "bg-app text-muted-foreground"
              }`}>
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={`text-sm ${active ? "font-semibold" : done ? "text-brand" : "text-muted-foreground"}`}>{label}</span>
            </button>
            {i < STEP_COUNT - 1 && <span className={`mx-3 h-px flex-1 ${done ? "bg-brand/40" : "bg-black/10"}`} />}
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------- SummaryBar --------------------------------- */

function SummaryBar({ channel, audienceLabel, reach, reachKind }: {
  channel: OwnerBroadcastChannel; audienceLabel: string; reach: number | null; reachKind: "line" | "app";
}) {
  const tp = useMessages("owner").broadcast;
  const ChIcon = channel === "line" ? MessageCircle : Smartphone;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Chip><ChIcon className="size-3.5 text-brand" /> {channelLabel(channel, tp)}</Chip>
      <span className="text-muted-foreground">·</span>
      <Chip><Users className="size-3.5 text-muted-foreground" /> {audienceLabel}</Chip>
      <span className="text-muted-foreground">·</span>
      <Chip>
        {reachKind === "line" ? <Wifi className="size-3.5 text-brand" /> : <Bell className="size-3.5 text-brand" />}
        {reach == null ? tp.dash : <><strong className="tabular-nums">{fmt.format(reach)}</strong> {tp.peopleUnit.replace("{n} ", "")}</>}
      </Chip>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-medium ring-1 ring-black/5">
      {children}
    </span>
  );
}

/* ------------------------------ Phone + previews ------------------------------ */

// Grows with its content (min height keeps a phone shape for short messages;
// long messages extend it so nothing is clipped).
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[216px] rounded-[2rem] border-[9px] border-neutral-900 bg-neutral-900 shadow-lg">
      <div className="relative overflow-hidden rounded-[1.35rem] bg-white">
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-[15px] w-[72px] -translate-x-1/2 rounded-b-[0.8rem] bg-neutral-900" />
        {children}
      </div>
    </div>
  );
}

// Status bar (time + signal/wifi/battery) tinted for the screen it sits on.
function StatusBar({ tone }: { tone: "light" | "dark" }) {
  const cls = tone === "light" ? "text-white" : "text-neutral-800";
  return (
    <div className={`flex items-center px-4 pt-1.5 pb-0.5 text-[10px] font-medium ${cls}`}>
      <span className="tabular-nums">9:41</span>
      <span className="ml-auto flex items-center gap-1">
        <Signal className="size-3" /> <Wifi className="size-3" /> <BatteryFull className="size-3.5" />
      </span>
    </div>
  );
}

function LineChatPreview({ title, message, imageUrl }: { title: string; message: string; imageUrl?: string | null }) {
  const tp = useMessages("owner").broadcast;
  return (
    <div className="flex min-h-[430px] flex-col">
      <div className="bg-[#06C755] text-white">
        <StatusBar tone="light" />
        <div className="flex items-center gap-2 px-3 pb-2">
          <ChevronLeft className="size-4 opacity-90" />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">{tp.previewShop}</div>
            <div className="text-[10px] opacity-80">{tp.previewOnline}</div>
          </div>
          <Search className="ml-auto size-4 opacity-90" />
        </div>
      </div>
      <div className="flex-1 space-y-3 bg-[#8CA9C6] p-3">
        <div className="flex justify-center">
          <span className="rounded-full bg-black/15 px-2.5 py-0.5 text-[10px] text-white">{tp.previewToday}</span>
        </div>
        <div className="flex items-start gap-2">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-white/90 text-[#06C755]">
            <MessageCircle className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="mb-1 text-[10px] text-white/90">{tp.previewShop}</div>
            <div className="flex items-end gap-1">
              <div className="w-[164px] overflow-hidden rounded-2xl rounded-tl-sm bg-white shadow-sm">
                {imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="" className="max-h-28 w-full object-cover" />
                )}
                <div className="px-3 py-2">
                  <div className={`text-sm font-semibold ${title.trim() ? "" : "text-muted-foreground"}`}>
                    {title.trim() || tp.previewTitlePh}
                  </div>
                  <div className="mt-0.5 whitespace-pre-wrap break-words text-sm text-neutral-700">
                    {message.trim() || tp.previewMsgPh}
                  </div>
                </div>
              </div>
              <span className="shrink-0 pb-0.5 text-[9px] text-white/80">15:29</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppNotificationPreview({ title, message, imageUrl }: { title: string; message: string; imageUrl?: string | null }) {
  const tp = useMessages("owner").broadcast;
  return (
    <div className="flex min-h-[430px] flex-col bg-app">
      <div className="bg-white">
        <StatusBar tone="dark" />
        <div className="flex items-center gap-2 border-b border-black/5 px-3 pb-2">
          <Bell className="size-4 text-brand" />
          <span className="text-sm font-semibold">{tp.previewNotif}</span>
        </div>
      </div>
      <div className="flex-1 p-3">
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="max-h-28 w-full object-cover" />
          )}
          <div className="flex items-start gap-3 p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <Bell className="size-5" />
            </span>
            <div className="min-w-0">
              <div className={`text-sm font-semibold ${title.trim() ? "" : "text-muted-foreground"}`}>
                {title.trim() || tp.previewTitlePh}
              </div>
              <div className="mt-0.5 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                {message.trim() || tp.previewMsgPh}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{tp.previewJustNow}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- History ---------------------------------- */

function HistoryRow({ broadcast, onOpen }: { broadcast: OwnerBroadcast; onOpen: () => void }) {
  const tp = useMessages("owner").broadcast;
  const { locale } = useLocale();
  const sent = broadcast.status === "sent";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-black/5 transition hover:bg-app hover:shadow-md active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{broadcast.title}</div>
          <div className="truncate text-sm text-muted-foreground">{broadcast.message}</div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
          sent ? "bg-brand/10 text-brand" : "bg-amber-100 text-amber-700"
        }`}>
          {sent ? tp.statusSent : tp.statusDraft}
        </span>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-app px-2.5 py-0.5 font-medium ring-1 ring-black/5">{channelLabel(broadcast.channel, tp)}</span>
        <span className="rounded-full bg-app px-2.5 py-0.5 font-medium ring-1 ring-black/5">
          {(tp.audShort as Record<string, string>)[broadcast.audience] ?? broadcast.audience}{broadcast.segmentName ? ` · ${broadcast.segmentName}` : ""}
        </span>
        <span className="tabular-nums">{interp(tp.recipients, { n: fmt.format(broadcast.recipientCount) })}</span>
        {sent && broadcast.sentAt && <span>{interp(tp.sentAt, { date: fmtDateTime(broadcast.sentAt, locale) })}</span>}
      </div>
    </button>
  );
}

// Detail sheet for one history item — view + edit (draft) / send (draft) / delete.
function BroadcastDetail({
  broadcast,
  onClose,
  onEdit,
  onDelete,
  onSend,
  deleting,
  sending,
}: {
  broadcast: OwnerBroadcast;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSend: () => void;
  deleting: boolean;
  sending: boolean;
}) {
  const tp = useMessages("owner").broadcast;
  const { locale } = useLocale();
  const draft = broadcast.status === "draft";
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-in fade-in duration-200 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white animate-in slide-in-from-bottom duration-300 ease-out sm:rounded-2xl sm:zoom-in-95 sm:slide-in-from-bottom-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-5">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                draft ? "bg-amber-100 text-amber-700" : "bg-brand/10 text-brand"
              }`}>{draft ? tp.statusDraft : tp.statusSent}</span>
              <span className="text-xs text-muted-foreground">
                {channelLabel(broadcast.channel, tp)} · {(tp.audShort as Record<string, string>)[broadcast.audience] ?? broadcast.audience}
                {broadcast.segmentName ? ` · ${broadcast.segmentName}` : ""}
              </span>
            </div>
            <h2 className="text-base font-semibold text-balance">{broadcast.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={tp.close}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-app">
            <X className="size-4" />
          </button>
        </div>

        {broadcast.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={broadcast.imageUrl} alt="" className="max-h-64 w-full object-contain" />
        )}

        <p className="whitespace-pre-wrap px-5 py-4 text-sm text-neutral-700">{broadcast.message}</p>

        <div className="px-5 pb-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{interp(tp.recipients, { n: fmt.format(broadcast.recipientCount) })}</span>
          {broadcast.sentAt && <> {interp(tp.sentAt, { date: fmtDateTime(broadcast.sentAt, locale) })}</>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-black/5 p-4">
          <Button type="button" variant="outline" onClick={onDelete} disabled={deleting}
            className="text-brand-danger">
            <Trash2 className="size-4" /> {deleting ? tp.deleting : tp.delete}
          </Button>
          {draft && (
            <>
              <Button type="button" variant="outline" onClick={onEdit}>
                <Pencil className="size-4" /> {tp.edit}
              </Button>
              <Button type="button" onClick={onSend} disabled={sending}>
                <Send className="size-4" /> {sending ? tp.sending : tp.sendNow}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
