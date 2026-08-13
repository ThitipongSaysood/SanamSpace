"use client";
import { toastSave } from "@/lib/toast";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronRight,
  Crown,
  History,
  Home,
  Link2,
  Package,
  Palette,
  Store,
  User,
  Wallet,
} from "lucide-react";
import type { OwnerSettings } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMessages } from "@/lib/i18n/context";
import { fmt as interp } from "@/lib/i18n/format";

const TABS = [
  { key: "info", icon: Store },
  { key: "storefront", icon: Palette },
  { key: "payment", icon: Wallet },
  { key: "integrations", icon: Link2 },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * Ready-made three-colour themes.
 *
 * The old row of single swatches only ever set `primaryColor`, so a venue that
 * clicked one got a new primary and kept whatever secondary and accent it had
 * before — which is why the demo venue's secondary was still identical to its
 * primary and the gradients rendered flat.
 *
 * Each palette is picked as a set: `secondary` is a neighbouring hue so the
 * gradient reads as one colour deepening rather than two colours fighting, and
 * `accent` is light enough for the dark text the badges put on it.
 */
/** Single colours, for adjusting any one of the three by hand. */
const SWATCHES = ["#16a34a", "#0ea5e9", "#6366f1", "#a855f7", "#ec4899", "#ef4444", "#f59e0b", "#14b8a6"];

const PALETTES: { primary: string; secondary: string; accent: string }[] = [
  { primary: "#16A34A", secondary: "#059669", accent: "#F59E0B" },
  { primary: "#0EA5E9", secondary: "#2563EB", accent: "#FACC15" },
  { primary: "#6366F1", secondary: "#8B5CF6", accent: "#F9A8D4" },
  { primary: "#EA580C", secondary: "#DC2626", accent: "#FDE047" },
  { primary: "#14B8A6", secondary: "#0891B2", accent: "#FDE047" },
  { primary: "#18181B", secondary: "#3F3F46", accent: "#EAB308" },
];

export default function OwnerSettingsPage() {
  const ts = useMessages("owner").settings;
  const [tab, setTab] = useState<TabKey>("info");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "settings"],
    queryFn: ownerApi.getSettings,
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{ts.title}</h1>
        <p className="text-sm text-muted-foreground">{ts.subtitle}</p>
      </header>

      <div className="flex flex-wrap gap-1 border-b border-black/5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="size-4" /> {ts.tab[t.key]}
          </button>
        ))}
      </div>

      {isLoading && <Loading rows={2} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && tab === "info" && <InfoTab settings={data} />}
      {data && tab === "storefront" && <StorefrontTab settings={data} />}
      {data && tab === "integrations" && <IntegrationsTab settings={data} />}
      {data && tab === "payment" && <PaymentTab settings={data} />}
    </div>
  );
}

/**
 * Local copy of the settings + the save mutation.
 *
 * Both tabs edit the same settings object, so they share this rather than each
 * keeping their own half — a save from either sends the whole object back.
 */
function useOwnerSettingsForm(settings: OwnerSettings) {
  const qc = useQueryClient();
  const [form, setForm] = useState<OwnerSettings>(settings);

  // Re-seed during render, not in an effect, so the fields never paint a frame
  // of stale values after a save. React Query's structural sharing keeps the
  // reference stable when nothing changed, so typing is not interrupted.
  const [seeded, setSeeded] = useState(settings);
  if (seeded !== settings) {
    setSeeded(settings);
    setForm(settings);
  }

  const mutation = useMutation({
    mutationFn: () => toastSave(ownerApi.updateSettings(form)),
    onSuccess: (updated) => {
      qc.setQueryData(["owner", "settings"], updated);
      qc.invalidateQueries({ queryKey: ["owner", "settings"] });
    },
  });

  function set<K extends keyof OwnerSettings>(key: K, value: OwnerSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return { form, set, mutation };
}

/** Upload an image and hand back its URL, with busy/error flags for the button. */
function useImageUpload(onDone: (url: string) => void) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setFailed(false);
    try {
      onDone(await ownerApi.uploadImage(file));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return { busy, failed, onFile };
}

/**
 * The save row — the same one on every tab.
 *
 * There were three: a full-width button reading "บันทึกการเปลี่ยนแปลง" on one
 * tab, a small left-aligned "บันทึก" on another, and a third buried inside a
 * card rather than under the form. Same action, three sizes, three positions.
 *
 * `min-w-52` fixes the width so the button does not resize between
 * "บันทึกการเปลี่ยนแปลง" and "กำลังบันทึก..." either — a control that changes
 * size at the moment it is pressed is its own small wrongness.
 *
 * `className` is for the column span: every tab is a grid now, and the save row
 * belongs to the whole form rather than to the column it happens to follow.
 */
function SaveRow({
  mutation,
  className = "",
}: {
  mutation: ReturnType<typeof useOwnerSettingsForm>["mutation"];
  className?: string;
}) {
  const t = useMessages("owner").settings;
  return (
    <div className={`flex flex-wrap items-center gap-3 border-t border-black/5 pt-4 ${className}`}>
      <Button type="submit" disabled={mutation.isPending} className="min-w-52">
        {mutation.isPending ? t.saving : t.saveChanges}
      </Button>
      {mutation.isSuccess && !mutation.isPending && (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-brand">
          <Check className="size-4" /> {t.saved}
        </span>
      )}
      {mutation.isError && <span className="text-sm text-brand-danger">{t.saveFailed}</span>}
    </div>
  );
}

function InfoTab({ settings }: { settings: OwnerSettings }) {
  const t = useMessages("owner").settings;
  const { form, set, mutation } = useOwnerSettingsForm(settings);

  const fields: { key: keyof OwnerSettings; label: string; type?: string; full?: boolean }[] = [
    { key: "orgName", label: t.fOrgName, full: true },
    { key: "phone", label: t.fPhone, type: "tel" },
    { key: "email", label: t.fEmail, type: "email" },
    { key: "lineOaUrl", label: t.fLineOa, type: "url" },
    { key: "googleMapUrl", label: t.fGoogleMap, type: "url" },
    { key: "address", label: t.fAddress, full: true },
  ];

  /*
   * Two cards side by side once there is room for them.
   *
   * This was one column capped at max-w-3xl, which on a desk monitor left two
   * thirds of the screen empty and pushed the billing card below the fold for
   * no reason — the fields inside are already laid out two-up, so the cap was
   * not protecting readability, only wasting the width.
   *
   * `items-start` so a short card does not stretch to match a tall neighbour,
   * and the save row spans both columns: it belongs to the whole form.
   */
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="grid items-start gap-6 xl:grid-cols-2"
    >
      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="text-sm font-semibold">{t.venueInfoTitle}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className={`space-y-1.5 ${f.full ? "sm:col-span-2" : ""}`}>
              <Label htmlFor={`s-${f.key}`}>{f.label}</Label>
              <Input
                id={`s-${f.key}`}
                type={f.type ?? "text"}
                value={(form[f.key] as string) ?? ""}
                onChange={(e) => set(f.key, e.target.value as OwnerSettings[typeof f.key])}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Billing identity — what appears as the buyer on invoices/receipts. */}
      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div>
          <h2 className="text-sm font-semibold">{t.billingTitle}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t.billingHint}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="s-billingName">{t.billingNameLabel}</Label>
            <Input
              id="s-billingName"
              value={form.billingName ?? ""}
              onChange={(e) => set("billingName", e.target.value)}
              placeholder={t.billingNamePlaceholder}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-taxId">{t.taxIdLabel}</Label>
            <Input
              id="s-taxId"
              value={form.taxId ?? ""}
              onChange={(e) => set("taxId", e.target.value)}
              placeholder="0105562000000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-billingBranch">{t.billingBranchLabel}</Label>
            <Input
              id="s-billingBranch"
              value={form.billingBranch ?? ""}
              onChange={(e) => set("billingBranch", e.target.value)}
              placeholder={t.billingBranchPlaceholder}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="s-billingAddress">{t.billingAddressLabel}</Label>
            <Input
              id="s-billingAddress"
              value={form.billingAddress ?? ""}
              onChange={(e) => set("billingAddress", e.target.value)}
              placeholder={t.billingAddressPlaceholder}
            />
          </div>
        </div>
      </section>

      <SaveRow mutation={mutation} className="xl:col-span-2" />
    </form>
  );
}

/**
 * Everything a customer sees: the venue's logo, colours, greeting and banner —
 * with a live preview of the result. Split out of "ข้อมูลสนาม" because that tab
 * is business facts, and this one is the shopfront.
 */
function StorefrontTab({ settings }: { settings: OwnerSettings }) {
  const t = useMessages("owner").settings;
  const { form, set, mutation } = useOwnerSettingsForm(settings);
  const logo = useImageUpload((url) => set("logoUrl", url));

  const initials = (form.orgName || "S").trim().slice(0, 2).toUpperCase();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="grid gap-6 lg:grid-cols-3"
    >
      <div className="space-y-6 lg:col-span-2">
        {/* Logo */}
        <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-sm font-semibold">{t.logoTitle}</h2>
          <div className="flex items-center gap-3">
            {form.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.logoUrl}
                alt={t.logoAlt}
                className="size-16 shrink-0 rounded-2xl object-cover ring-1 ring-black/10"
              />
            ) : (
              <span
                className="grid size-16 shrink-0 place-items-center rounded-2xl text-xl font-bold text-white"
                style={{ background: form.primaryColor || "#16a34a" }}
              >
                {initials}
              </span>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="cursor-pointer rounded-lg border border-input px-3 py-1.5 text-center text-sm hover:bg-app">
                {logo.busy ? t.uploading : t.changeImage}
                <input type="file" accept="image/*" className="hidden" onChange={logo.onFile} disabled={logo.busy} />
              </label>
              {form.logoUrl && (
                <button
                  type="button"
                  onClick={() => set("logoUrl", null)}
                  className="text-xs text-muted-foreground hover:text-brand-danger"
                >
                  {t.removeLogo}
                </button>
              )}
            </div>
          </div>
          {logo.failed && <p className="text-xs text-brand-danger">{t.uploadFailed}</p>}
        </section>

        {/* Brand colours */}
        <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <div>
            <h2 className="text-sm font-semibold">{t.themeTitle}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t.themeHint}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PALETTES.map((pal, i) => {
              // Selected only when all three match — a palette is the set, and
              // saying "เขียวสนาม" while the accent has been changed by hand
              // would be a lie the venue then has to un-pick.
              const active =
                form.primaryColor?.toUpperCase() === pal.primary &&
                form.secondaryColor?.toUpperCase() === pal.secondary &&
                form.accentColor?.toUpperCase() === pal.accent;

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    set("primaryColor", pal.primary);
                    set("secondaryColor", pal.secondary);
                    set("accentColor", pal.accent);
                  }}
                  aria-pressed={active}
                  className={`flex items-center gap-2 rounded-xl p-2 ring-2 transition ${
                    active ? "ring-foreground" : "ring-black/5 hover:ring-black/20"
                  }`}
                >
                  <span
                    className="size-7 shrink-0 rounded-full"
                    style={{ background: `linear-gradient(135deg, ${pal.primary}, ${pal.secondary})` }}
                  />
                  <span className="size-4 shrink-0 rounded-full" style={{ background: pal.accent }} />
                  <span className="truncate text-xs font-medium">{t.paletteNames[i]}</span>
                </button>
              );
            })}
          </div>

          {/* Fine-tune each colour on its own. A colour "well" shows the current
              value and opens the native picker; the quick swatches cover all
              three (they once set only สีหลัก, so the other two could be changed
              by the slow native picker alone — why most venues never touched
              them). */}
          <div className="space-y-4 border-t border-black/5 pt-4">
            <p className="text-xs font-medium text-muted-foreground">{t.customPerColor}</p>
            {(
              [
                ["primaryColor", t.colorPrimaryLabel, t.colorPrimaryHint],
                ["secondaryColor", t.colorSecondaryLabel, t.colorSecondaryHint],
                ["accentColor", t.colorAccentLabel, t.colorAccentHint],
              ] as const
            ).map(([key, label, hint]) => {
              const value = (form[key] as string) || "";
              return (
                <div key={key} className="flex items-start gap-3">
                  <label
                    className="relative mt-0.5 size-11 shrink-0 cursor-pointer rounded-xl ring-1 ring-black/10 ring-offset-1 transition hover:ring-black/25"
                    style={{ background: value || "#e5e7eb" }}
                    title={t.pickColor}
                  >
                    <input
                      type="color"
                      aria-label={interp(t.pickColorAria, { label })}
                      value={value || "#000000"}
                      onChange={(e) => set(key, e.target.value)}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </label>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">{label}</span>
                      <span className="truncate text-xs text-muted-foreground">{hint}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {SWATCHES.map((c) => {
                        const on = value.toLowerCase() === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            aria-label={interp(t.swatchAria, { label, color: c })}
                            aria-pressed={on}
                            onClick={() => set(key, c)}
                            className={`size-6 rounded-full ring-2 ring-offset-1 transition ${
                              on ? "ring-foreground" : "ring-transparent hover:ring-black/20"
                            }`}
                            style={{ background: c }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-sm font-semibold">{t.checkinTitle}</h2>
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm">
              {t.checkinDesc}
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t.checkinHintPre}
                <Link href="/owner/checkin" className="font-semibold text-brand">
                  {t.checkinLink}
                </Link>
              </span>
            </div>
            <Switch
              checked={form.checkinEnabled !== false}
              onCheckedChange={(v) => set("checkinEnabled", v)}
              aria-label={t.checkinTitle}
            />
          </div>
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-sm font-semibold">{t.depositTitle}</h2>
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm">
              {t.depositDesc}
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t.depositHint}
              </span>
            </div>
            <Switch
              checked={form.depositEnabled === true}
              onCheckedChange={(v) => set("depositEnabled", v)}
              aria-label={t.depositTitle}
            />
          </div>

          {form.depositEnabled && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="deposit-type">{t.depositTypeLabel}</Label>
                <select
                  id="deposit-type"
                  value={form.depositType ?? "percent"}
                  onChange={(e) => set("depositType", e.target.value as "percent" | "fixed")}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  <option value="percent">{t.depositPercent}</option>
                  <option value="fixed">{t.depositFixed}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deposit-value">
                  {form.depositType === "fixed" ? t.depositFixedValue : t.depositPercentValue}
                </Label>
                <Input
                  id="deposit-value"
                  type="number"
                  min={0}
                  value={form.depositValue ?? 0}
                  onChange={(e) => set("depositValue", Number(e.target.value))}
                />
              </div>
              {/* Said plainly: a deposit at or above the price is just paying
                  in full, and the backend stores it as no deposit at all. */}
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                {t.depositNote}
              </p>
            </div>
          )}
        </section>

      </div>

      <div className="lg:col-span-1">
        <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 lg:sticky lg:top-4">
          <BrandPreview form={form} />
        </section>
      </div>

      <SaveRow mutation={mutation} className="lg:col-span-3" />
    </form>
  );
}

/**
 * What the venue's own customers will see.
 *
 * The three colours used to be collected and then dropped — only `primary` ever
 * reached the customer app. Showing the result here is how an owner can tell
 * that picking a colour did something, without opening their own /v/{slug}.
 */
function BrandPreview({ form }: { form: OwnerSettings }) {
  const m = useMessages("owner").settings;
  // The real home shows the venue's own first promotion, so the preview does
  // too — a preview that invents content is worse than no preview.
  const { data: promos } = useQuery({
    queryKey: ["owner", "promotions"],
    queryFn: ownerApi.getOwnerPromotions,
  });
  const promo = promos?.[0] ?? null;

  // Likewise the venue's own topmost live banner, edited over in /owner/banner.
  const { data: banners } = useQuery({
    queryKey: ["owner", "welcome-banners"],
    queryFn: ownerApi.getWelcomeBanners,
  });
  const banner = banners?.find((b) => b.isActive) ?? null;

  const primary = form.primaryColor || "#16A34A";
  const secondary = form.secondaryColor || primary;
  const accent = form.accentColor || "#F59E0B";
  const initials = (form.logoText || form.orgName || "?").trim().slice(0, 2).toUpperCase();

  // Show the whole home the way a customer sees it, in the venue's colours.
  const pointsOn = form.pointsEnabled ?? false;
  const tint = `${primary}1A`; // 10% wash for icon chips / status pills
  const tiles = [
    { icon: History, title: m.tileHistory, sub: m.tileHistorySub },
    ...(pointsOn ? [{ icon: Crown, title: m.tilePoints, sub: m.tilePointsSub }] : []),
    { icon: Package, title: m.tilePackages, sub: m.tilePackagesSub },
    { icon: Store, title: m.tileVenue, sub: m.tileVenueSub },
  ];
  const nav = [
    { icon: Home, label: m.navHome },
    { icon: CalendarDays, label: m.navBookings },
    { icon: Bell, label: m.navNotif },
    { icon: User, label: m.navProfile },
  ];

  return (
    <div className="space-y-2 border-t border-black/5 pt-4">
      <Label>{m.previewLabel}</Label>
      {/* A faithful mock of the customer home, so an owner sees the whole thing
          in their own colours — not just a swatch. */}
      <div className="overflow-hidden rounded-2xl bg-[oklch(0.969_0.007_155)] ring-1 ring-black/10">
        {/* Header */}
        <div className="flex items-center gap-2 bg-white px-3 py-2.5">
          {form.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logoUrl} alt="" className="size-8 rounded-lg object-cover" />
          ) : (
            <span
              className="grid size-8 place-items-center rounded-lg text-xs font-bold text-white"
              style={{ background: primary }}
            >
              {initials}
            </span>
          )}
          <span className="truncate text-sm font-bold uppercase tracking-wide">{form.orgName || m.venueNamePh}</span>
          <span className="ml-auto text-muted-foreground">
            <Bell className="size-4" />
          </span>
          <span className="grid size-6 place-items-center rounded-full text-[10px] font-bold" style={{ background: tint, color: primary }}>
            {m.greetCustomer.slice(0, 1)}
          </span>
        </div>

        <div className="space-y-2.5 p-3">
          {/* Greeting + standing */}
          <div
            className="rounded-2xl p-3 text-white"
            style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] text-white/85">{m.greetHi}</div>
                <div className="text-sm font-bold">{m.greetCustomer}</div>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-semibold">
                  <Crown className="size-2.5" /> Silver
                </span>
              </div>
              {pointsOn && (
                <div className="shrink-0 text-right">
                  <div className="text-[9px] text-white/85">{m.pointsLabel}</div>
                  <div className="text-lg font-bold leading-none">0</div>
                </div>
              )}
            </div>
          </div>

          {/* The venue's live welcome banner, if any */}
          {banner?.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={banner.imageUrl} alt={m.bannerAlt} className="block h-auto w-full rounded-xl" />
          )}
          {(banner?.title || banner?.message) && (
            <div className="rounded-xl bg-white p-2.5">
              {banner.title && <div className="text-xs font-semibold">{banner.title}</div>}
              {banner.message && (
                <div className="mt-0.5 line-clamp-2 whitespace-pre-line text-[10px] text-muted-foreground">
                  {banner.message}
                </div>
              )}
            </div>
          )}

          {/* Book a court — the primary action */}
          <div className="flex items-center gap-2.5 rounded-2xl bg-white p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: primary }}>
              <CalendarPlus className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold">{m.bookTitle}</div>
              <div className="truncate text-[10px] text-muted-foreground">{m.bookSub}</div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </div>

          {/* Shortcut tiles */}
          <div className="grid grid-cols-2 gap-2">
            {tiles.map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.title} className="rounded-2xl bg-white p-2.5">
                  <span className="grid size-7 place-items-center rounded-lg" style={{ background: tint, color: primary }}>
                    <Icon className="size-4" />
                  </span>
                  <div className="mt-1.5 text-[11px] font-bold leading-tight">{t.title}</div>
                  <div className="truncate text-[9px] text-muted-foreground">{t.sub}</div>
                </div>
              );
            })}
          </div>

          {/* Upcoming booking */}
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-xs font-bold">{m.upcomingTitle}</span>
            <span className="text-[10px] font-semibold" style={{ color: primary }}>{m.seeAll}</span>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl bg-white p-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: tint, color: primary }}>
              <CalendarCheck className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold">Court 1</span>
                <span className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold" style={{ background: tint, color: primary }}>
                  {m.confirmed}
                </span>
              </div>
              <div className="truncate text-[9px] text-muted-foreground">{form.orgName || m.venuePh2} · 20:00–21:00</div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </div>

          {/* Promo — where all three colours land */}
          {promo ? (
            <div
              className="flex items-center gap-2.5 rounded-2xl p-3 text-white"
              style={{ background: `linear-gradient(to right, ${primary}, ${secondary})` }}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">{promo.title}</div>
                {promo.subtitle && <div className="truncate text-[10px] text-white/85">{promo.subtitle}</div>}
              </div>
              {promo.tag && (
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-black/80"
                  style={{ background: accent }}
                >
                  {promo.tag}
                </span>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-black/15 p-3 text-center text-[10px] text-muted-foreground">
              {m.noPromo}
            </div>
          )}
        </div>

        {/* Bottom nav */}
        <div className="flex items-center justify-around border-t border-black/5 bg-white px-1 py-1.5">
          {nav.map((n, i) => {
            const Icon = n.icon;
            const on = i === 0;
            return (
              <div
                key={n.label}
                className={`flex flex-col items-center gap-0.5 ${on ? "" : "text-muted-foreground"}`}
                style={on ? { color: primary } : undefined}
              >
                <Icon className="size-4" />
                <span className={`text-[8px] ${on ? "font-semibold" : ""}`}>{n.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {m.previewSaveNote}
      </p>
    </div>
  );
}

function PaymentTab({ settings }: { settings: OwnerSettings }) {
  const t = useMessages("owner").settings;
  const qc = useQueryClient();
  const [form, setForm] = useState<OwnerSettings>(settings);

  // Re-seed during render, not in an effect, so the fields never paint a frame
  // of stale values after a save. React Query's structural sharing keeps the
  // reference stable when nothing changed, so typing is not interrupted.
  const [seeded, setSeeded] = useState(settings);
  if (seeded !== settings) {
    setSeeded(settings);
    setForm(settings);
  }

  const mutation = useMutation({
    mutationFn: () => toastSave(ownerApi.updateSettings(form)),
    onSuccess: (updated) => {
      qc.setQueryData(["owner", "settings"], updated);
      qc.invalidateQueries({ queryKey: ["owner", "settings"] });
    },
  });

  const set = (key: keyof OwnerSettings, value: string) => setForm((f) => ({ ...f, [key]: value }));

  // Auto slip-check saves on its own (gated endpoint, its own plan feature) so
  // it never rides along with — or gets blocked by — the general save button.
  const slipMode = useMutation({
    mutationFn: (mode: "manual" | "auto") => toastSave(ownerApi.updateSlipVerifyMode(mode)),
    onSuccess: (updated) => {
      qc.setQueryData(["owner", "settings"], updated);
      qc.invalidateQueries({ queryKey: ["owner", "settings"] });
    },
    // Plan doesn't include it (402) or any failure → undo the optimistic flip.
    onError: () => set("slipVerifyMode", settings.slipVerifyMode ?? "manual"),
  });

  /*
   * Two cards, because these are two different ways to be paid.
   *
   * PromptPay is the QR the system generates for the exact amount; the bank
   * account is what a customer transfers to by hand and then uploads a slip
   * for. They were one block called "บัญชีรับเงินของสนาม", which read as one
   * setting and left a single narrow card on a wide screen.
   */
  type PayField = { key: keyof OwnerSettings; label: string; placeholder?: string; hint?: string; full?: boolean };

  const promptpayFields: PayField[] = [
    { key: "promptpayId", label: t.ppIdLabel, placeholder: "0812345678", hint: t.ppIdHint, full: true },
    { key: "promptpayName", label: t.ppNameLabel, placeholder: t.ppNamePlaceholder, full: true },
  ];

  const bankFields: PayField[] = [
    { key: "bankName", label: t.bankNameLabel, placeholder: t.bankNamePlaceholder },
    { key: "bankAccountNumber", label: t.bankAcctNumLabel, placeholder: "123-4-56789-0" },
    { key: "bankAccountName", label: t.bankAcctNameLabel, full: true },
  ];

  const payCard = (title: string, hint: string, list: PayField[]) => (
    <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((f) => (
          <div key={f.key} className={`space-y-1.5 ${f.full ? "sm:col-span-2" : ""}`}>
            <Label htmlFor={`pay-${f.key}`}>{f.label}</Label>
            <Input
              id={`pay-${f.key}`}
              value={(form[f.key] as string) ?? ""}
              placeholder={f.placeholder}
              onChange={(e) => set(f.key, e.target.value)}
            />
            {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="grid items-start gap-6 xl:grid-cols-2"
    >
      {payCard(
        t.ppTitle,
        t.ppHint,
        promptpayFields,
      )}
      {payCard(
        t.bankTitle,
        t.bankHint,
        bankFields,
      )}

      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 xl:col-span-2">
        <h2 className="text-sm font-semibold">{t.slipTitle}</h2>
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm">
            {t.slipAuto}
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {t.slipAutoHint}
            </span>
          </div>
          <Switch
            checked={form.slipVerifyMode === "auto"}
            disabled={slipMode.isPending}
            onCheckedChange={(v) => {
              const mode = v ? "auto" : "manual";
              set("slipVerifyMode", mode); // optimistic; reverted onError
              slipMode.mutate(mode);
            }}
            aria-label={t.slipAuto}
          />
        </div>
        <p className="text-xs text-amber-600">{t.slipNotConnected}</p>
      </section>

      <SaveRow mutation={mutation} className="xl:col-span-2" />
    </form>
  );
}

function IntegrationsTab({ settings }: { settings: OwnerSettings }) {
  const t = useMessages("owner").settings;
  const qc = useQueryClient();

  // Plain identifiers edit in place; the two secrets are WRITE-ONLY — we keep
  // them as local input state, start them blank, and only send them when the
  // owner actually types something (a blank submit must not wipe a stored one).
  const [channelId, setChannelId] = useState(settings.lineChannelId ?? "");
  const [liffId, setLiffId] = useState(settings.lineLiffId ?? "");
  const [channelSecret, setChannelSecret] = useState("");
  const [messagingToken, setMessagingToken] = useState("");

  useEffect(() => {
    setChannelId(settings.lineChannelId ?? "");
    setLiffId(settings.lineLiffId ?? "");
    setChannelSecret("");
    setMessagingToken("");
  }, [settings]);

  const mutation = useMutation({
    mutationFn: () => {
      const patch: Parameters<typeof ownerApi.updateSettings>[0] = {
        lineChannelId: channelId,
        lineLiffId: liffId,
      };
      // Only include a secret when the owner typed a new value.
      if (channelSecret.trim()) patch.lineChannelSecret = channelSecret;
      if (messagingToken.trim()) patch.lineMessagingToken = messagingToken;
      return toastSave(ownerApi.updateSettings(patch));
    },
    onSuccess: (updated) => {
      qc.setQueryData(["owner", "settings"], updated);
      qc.invalidateQueries({ queryKey: ["owner", "settings"] });
      // Never keep typed secrets around after a save.
      setChannelSecret("");
      setMessagingToken("");
    },
  });

  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      {/* LINE Official Account status (URL is edited on the "ข้อมูลสนาม" tab) */}
      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="text-sm font-semibold">{t.connectionsTitle}</h2>
        <div className="flex items-center justify-between rounded-xl bg-app/60 p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[#06C755] text-sm font-bold text-white">
              LINE
            </span>
            <div>
              <div className="text-sm font-semibold">{t.lineOaTitle}</div>
              <div className="text-xs text-muted-foreground">{settings.lineOaUrl || t.notConnectedUrl}</div>
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              settings.lineOaUrl ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
            }`}
          >
            {settings.lineOaUrl ? t.connected : t.notConnectedShort}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{t.editOaHint}</p>
      </section>

      {/* LINE (เชื่อมต่อ) — per-venue LINE Login / LIFF / Messaging credentials.
          `contents` so the form takes part in the page grid rather than
          becoming a box inside it: the card and the save row below are then
          laid out as siblings of the status card, which is what puts the save
          row in the same place as on every other tab. */}
      <form
        className="contents"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <div>
            <h2 className="text-sm font-semibold">{t.lineConnectTitle}</h2>
            <p className="text-xs text-muted-foreground">
              {t.lineConnectHint}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="line-channel-id">Channel ID</Label>
              <Input
                id="line-channel-id"
                value={channelId}
                placeholder="1660000000"
                onChange={(e) => setChannelId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">LINE Login channel ID</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="line-liff-id">LIFF ID</Label>
              <Input
                id="line-liff-id"
                value={liffId}
                placeholder="1660000000-abcdEFGh"
                onChange={(e) => setLiffId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t.liffHint}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="line-channel-secret">Channel Secret</Label>
              <Input
                id="line-channel-secret"
                type="password"
                autoComplete="new-password"
                value={channelSecret}
                placeholder={settings.lineChannelSecretSet ? "••••••••" : ""}
                onChange={(e) => setChannelSecret(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {settings.lineChannelSecretSet
                  ? t.secretSet
                  : t.channelSecretUnset}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="line-messaging-token">Messaging Token</Label>
              <Input
                id="line-messaging-token"
                type="password"
                autoComplete="new-password"
                value={messagingToken}
                placeholder={settings.lineMessagingTokenSet ? "••••••••" : ""}
                onChange={(e) => setMessagingToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {settings.lineMessagingTokenSet
                  ? t.secretSet
                  : t.tokenUnset}
              </p>
            </div>
          </div>
        </section>

        <SaveRow mutation={mutation} className="xl:col-span-2" />
      </form>
    </div>
  );
}

