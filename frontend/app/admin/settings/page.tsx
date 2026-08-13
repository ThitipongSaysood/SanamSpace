"use client";
import { toast } from "@/lib/toast";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Settings2, Mail, Wallet, Shield, Bell, Database, Download } from "lucide-react";
import type { Backup, PlatformSettings } from "@/lib/types";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMessages, useLocale } from "@/lib/i18n/context";
import { intlLocale } from "@/lib/i18n/format";

const TABS = [
  { key: "general", icon: Settings2 },
  { key: "email", icon: Mail },
  { key: "payment", icon: Wallet },
  { key: "security", icon: Shield },
  { key: "notifications", icon: Bell },
  { key: "backup", icon: Database },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminSettingsPage() {
  const ts = useMessages("admin").adminSettings;
  const [tab, setTab] = useState<TabKey>("general");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: superAdminApi.getSettings,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">{ts.title}</h1>
        <p className="text-sm text-muted-foreground">{ts.subtitle}</p>
      </div>

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
            <t.icon className="size-4" /> {ts.tabs[t.key]}
          </button>
        ))}
      </div>

      {isLoading && <Loading rows={2} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && tab === "general" && <GeneralTab settings={data} />}
      {data && tab === "email" && <EmailTab settings={data} />}
      {data && tab === "payment" && <PaymentTab settings={data} />}
      {data && tab === "security" && <SecurityTab settings={data} />}
      {data && tab === "notifications" && <NotificationsTab settings={data} />}
      {tab === "backup" && <BackupTab />}
    </div>
  );
}

/** A simple on/off switch matching the brand. */
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-brand" : "bg-muted"}`}
    >
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function ToggleRow({
  label,
  desc,
  on,
  onToggle,
}: {
  label: string;
  desc?: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-black/5 px-4 py-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
      </div>
      <Toggle on={on} onClick={onToggle} />
    </div>
  );
}

/** Shared form behaviour: local copy of settings, save via updateSettings, success flag. */
function useSettingsForm(settings: PlatformSettings) {
  const qc = useQueryClient();
  const [form, setForm] = useState<PlatformSettings>({ ...settings, mailPassword: "", slipVerifyKey: "" });
  useEffect(() => setForm({ ...settings, mailPassword: "", slipVerifyKey: "" }), [settings]);

  const mutation = useMutation({
    mutationFn: () => superAdminApi.updateSettings(form),
    onSuccess: (updated) => {
      qc.setQueryData(["admin", "settings"], updated);
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
  });

  const set = (k: keyof PlatformSettings, v: string) => setForm((s) => ({ ...s, [k]: v }));
  const setField = <K extends keyof PlatformSettings>(k: K, v: PlatformSettings[K]) =>
    setForm((s) => ({ ...s, [k]: v }));
  return { form, set, setField, mutation };
}

function SaveBar({ mutation }: { mutation: ReturnType<typeof useSettingsForm>["mutation"] }) {
  const t = useMessages("admin").adminSettings;
  return (
    <div className="flex items-center gap-3 border-t border-black/5 pt-4">
      <Button type="submit" disabled={mutation.isPending}>
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

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  k,
  label,
  form,
  set,
  type = "text",
  placeholder,
  full,
}: {
  k: keyof PlatformSettings;
  label: string;
  form: PlatformSettings;
  set: (k: keyof PlatformSettings, v: string) => void;
  type?: string;
  placeholder?: string;
  full?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={`ps-${k}`}>{label}</Label>
      <Input
        id={`ps-${k}`}
        type={type}
        value={(form[k] as string) ?? ""}
        placeholder={placeholder}
        onChange={(e) => set(k, e.target.value)}
      />
    </div>
  );
}

function GeneralTab({ settings }: { settings: PlatformSettings }) {
  const t = useMessages("admin").adminSettings;
  const { form, set, mutation } = useSettingsForm(settings);
  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="max-w-3xl space-y-4">
      <Card title={t.generalTitle}>
        <Field k="platformName" label={t.fPlatformName} form={form} set={set} />
        <Field k="supportEmail" label={t.fSupportEmail} type="email" form={form} set={set} />
        <Field k="timezone" label={t.fTimezone} form={form} set={set} />
        <Field k="currency" label={t.fCurrency} form={form} set={set} />
        <Field k="dateFormat" label={t.fDateFormat} form={form} set={set} />
        <Field k="language" label={t.fLanguage} form={form} set={set} />
      </Card>
      <SaveBar mutation={mutation} />
    </form>
  );
}

function EmailTab({ settings }: { settings: PlatformSettings }) {
  const t = useMessages("admin").adminSettings;
  const { form, set, mutation } = useSettingsForm(settings);
  const smtp = form.mailMailer === "smtp";
  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="max-w-3xl space-y-4">
      <Card title={t.emailTitle} desc={t.emailDesc}>
        <div className="space-y-1.5">
          <Label htmlFor="ps-mailMailer">{t.mailerLabel}</Label>
          <select
            id="ps-mailMailer"
            value={form.mailMailer}
            onChange={(e) => set("mailMailer", e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
          >
            <option value="log">{t.mailerLog}</option>
            <option value="smtp">{t.mailerSmtp}</option>
            <option value="sendmail">{t.mailerSendmail}</option>
          </select>
        </div>
        {smtp && (
          <>
            <Field k="mailHost" label="SMTP Host" form={form} set={set} placeholder="smtp.gmail.com" />
            <Field k="mailPort" label={t.fPort} form={form} set={set} placeholder="587" />
            <Field k="mailUsername" label="Username" form={form} set={set} placeholder="billing@yourco.com" />
            <div className="space-y-1.5">
              <Label htmlFor="ps-mailPassword">{t.passwordLabel}</Label>
              <Input
                id="ps-mailPassword"
                type="password"
                value={form.mailPassword ?? ""}
                placeholder={form.mailPasswordSet ? t.passwordSet : t.passwordUnset}
                onChange={(e) => set("mailPassword", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-mailEncryption">{t.encryptionLabel}</Label>
              <select
                id="ps-mailEncryption"
                value={form.mailEncryption ?? "tls"}
                onChange={(e) => set("mailEncryption", e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
              >
                <option value="tls">TLS (587)</option>
                <option value="ssl">SSL (465)</option>
              </select>
            </div>
            <Field k="mailFromAddress" label={t.fFromAddress} type="email" form={form} set={set} placeholder="billing@yourco.com" />
            <Field k="mailFromName" label={t.fFromName} form={form} set={set} placeholder="SanamSpace" />
          </>
        )}
      </Card>
      <SaveBar mutation={mutation} />
    </form>
  );
}

function PaymentTab({ settings }: { settings: PlatformSettings }) {
  const t = useMessages("admin").adminSettings;
  const { form, set, setField, mutation } = useSettingsForm(settings);
  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="max-w-3xl space-y-4">
      <Card title={t.docIssuerTitle} desc={t.docIssuerDesc}>
        <Field k="companyName" label={t.fCompanyName} form={form} set={set} placeholder="บริษัท สนามสเปซ จำกัด" />
        <Field k="taxId" label={t.fTaxId} form={form} set={set} placeholder="0105564000000" />
        <Field k="companyAddress" label={t.fCompanyAddress} form={form} set={set} placeholder="99/9 ถนน... กรุงเทพฯ 10110" />
      </Card>

      <Card title={t.vatTitle} desc={t.vatDesc}>
        <div className="sm:col-span-2">
          <ToggleRow
            label={t.vatToggle}
            desc={t.vatToggleDesc}
            on={!!form.vatEnabled}
            onToggle={() => setField("vatEnabled", !form.vatEnabled)}
          />
        </div>
        {form.vatEnabled && (
          <Field k="vatRate" label={t.fVatRate} form={form} set={set} placeholder="7" />
        )}
      </Card>

      <Card title={t.payTitle} desc={t.payDesc}>
        <Field k="promptpayId" label={t.fPromptpayId} form={form} set={set} placeholder="0812345678" />
        {/* Shown to the venue as "โอนให้ …" on the pay dialog, so it needs to be
            the name they will recognise on their banking app. */}
        <Field k="promptpayName" label={t.fPromptpayName} form={form} set={set} placeholder="บจก. สนามสเปซ" />
        <Field k="bankName" label={t.fBankName} form={form} set={set} placeholder="กสิกรไทย" />
        <Field k="bankAccountName" label={t.fBankAccountName} form={form} set={set} />
        <Field k="bankAccountNumber" label={t.fBankAccountNumber} form={form} set={set} />
      </Card>

      <Card
        title={t.slipTitle}
        desc={t.slipDesc}
      >
        <div className="sm:col-span-2">
          <ToggleRow
            label={t.slipToggle}
            desc={t.slipToggleDesc}
            on={!!form.slipVerifyEnabled}
            onToggle={() => setField("slipVerifyEnabled", !form.slipVerifyEnabled)}
          />
        </div>
        {form.slipVerifyEnabled && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="ps-slipVerifyDriver">{t.providerLabel}</Label>
              <select
                id="ps-slipVerifyDriver"
                value={form.slipVerifyDriver ?? "null"}
                onChange={(e) => set("slipVerifyDriver", e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
              >
                <option value="null">{t.providerNull}</option>
                <option value="slip2go">Slip2Go</option>
                <option value="slipok">SlipOK</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-slipVerifyKey">{t.apiSecretLabel}</Label>
              <Input
                id="ps-slipVerifyKey"
                type="password"
                value={form.slipVerifyKey ?? ""}
                placeholder={form.slipVerifyKeySet ? t.apiSecretSet : t.apiSecretUnset}
                onChange={(e) => set("slipVerifyKey", e.target.value)}
              />
            </div>
            <Field
              k="slipVerifyEndpoint"
              label={t.fEndpoint}
              form={form}
              set={set}
              placeholder="https://connect.slip2go.com/api/verify-slip/qr-code/info"
              full
            />
          </>
        )}
      </Card>
      <SaveBar mutation={mutation} />
    </form>
  );
}

function SecurityTab({ settings }: { settings: PlatformSettings }) {
  const t = useMessages("admin").adminSettings;
  const { form, set, setField, mutation } = useSettingsForm(settings);
  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="max-w-3xl space-y-4">
      <Card title={t.securityTitle} desc={t.securityDesc}>
        <Field k="sessionTimeoutMinutes" label={t.fSessionTimeout} type="number" form={form} set={set} />
        <Field k="passwordMinLength" label={t.fPasswordMin} type="number" form={form} set={set} />
        <div className="sm:col-span-2">
          <ToggleRow
            label={t.twoFaToggle}
            desc={t.twoFaDesc}
            on={form.twoFactorRequired}
            onToggle={() => setField("twoFactorRequired", !form.twoFactorRequired)}
          />
        </div>
      </Card>
      <SaveBar mutation={mutation} />
    </form>
  );
}

function NotificationsTab({ settings }: { settings: PlatformSettings }) {
  const t = useMessages("admin").adminSettings;
  const { form, setField, mutation } = useSettingsForm(settings);
  const rows: { key: keyof PlatformSettings; label: string; desc: string }[] = [
    { key: "notifyNewOrg", label: t.notifNewOrg, desc: t.notifNewOrgDesc },
    { key: "notifyPayment", label: t.notifPayment, desc: t.notifPaymentDesc },
    { key: "notifySubscriptionExpiring", label: t.notifExpiring, desc: t.notifExpiringDesc },
    { key: "notifySupportTicket", label: t.notifTicket, desc: t.notifTicketDesc },
  ];
  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="max-w-3xl space-y-4">
      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div>
          <h2 className="font-semibold">{t.notifTitle}</h2>
          <p className="text-sm text-muted-foreground">{t.notifDesc}</p>
        </div>
        {rows.map((r) => (
          <ToggleRow
            key={r.key}
            label={r.label}
            desc={r.desc}
            on={form[r.key] as boolean}
            onToggle={() => setField(r.key, !(form[r.key] as boolean) as never)}
          />
        ))}
        <SaveBar mutation={mutation} />
      </section>
    </form>
  );
}

function BackupTab() {
  const t = useMessages("admin").adminSettings;
  const { locale } = useLocale();
  const qc = useQueryClient();
  const { data: backups, isLoading } = useQuery({ queryKey: ["admin", "backups"], queryFn: superAdminApi.getBackups });
  const { data: settings } = useQuery({ queryKey: ["admin", "settings"], queryFn: superAdminApi.getSettings });

  const runM = useMutation({
    mutationFn: () => superAdminApi.runBackup(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "backups"] }),
  });

  const [downloading, setDownloading] = useState<string | null>(null);
  async function download(name: string) {
    setDownloading(name);
    try {
      await superAdminApi.downloadBackup(name);
    } catch {
      toast.error(t.downloadFailed);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      {settings && <BackupPolicy settings={settings} />}

      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{t.backupTitle}</h2>
            <p className="text-sm text-muted-foreground">{t.backupDesc}</p>
          </div>
          <Button type="button" onClick={() => runM.mutate()} disabled={runM.isPending}>
            <Database className="size-4" /> {runM.isPending ? t.backingUp : t.backupNow}
          </Button>
        </div>

        {isLoading && <Loading rows={2} />}
        {backups && backups.length === 0 && (
          <p className="rounded-xl bg-app px-4 py-6 text-center text-sm text-muted-foreground">{t.noBackups}</p>
        )}
        {backups && backups.length > 0 && (
          <ul className="divide-y divide-black/5">
            {backups.map((b: Backup) => (
              <li key={b.name} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm">{b.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(b.createdAt).toLocaleString(intlLocale(locale))} · {b.sizeLabel}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => download(b.name)}
                  disabled={downloading === b.name}
                >
                  <Download className="size-4" /> {downloading === b.name ? "..." : t.download}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function BackupPolicy({ settings }: { settings: PlatformSettings }) {
  const t = useMessages("admin").adminSettings;
  const { form, set, mutation } = useSettingsForm(settings);
  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
      <Card title={t.policyTitle}>
        <div className="space-y-1.5">
          <Label htmlFor="ps-backupFrequency">{t.frequencyLabel}</Label>
          <select
            id="ps-backupFrequency"
            value={form.backupFrequency}
            onChange={(e) => set("backupFrequency", e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
          >
            <option value="off">{t.freqOff}</option>
            <option value="daily">{t.freqDaily}</option>
            <option value="weekly">{t.freqWeekly}</option>
          </select>
        </div>
        <Field k="backupRetentionDays" label={t.fRetention} type="number" form={form} set={set} />
      </Card>
      <SaveBar mutation={mutation} />
    </form>
  );
}
