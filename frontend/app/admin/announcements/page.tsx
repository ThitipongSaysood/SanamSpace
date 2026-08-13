"use client";
import { toast } from "@/lib/toast";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus, Pencil, Trash2 } from "lucide-react";
import type { AdminAnnouncement } from "@/lib/types";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useMessages, useLocale } from "@/lib/i18n/context";
import { fmt as interp, intlLocale } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";

const KEY = ["admin", "announcements"];

function fmtDate(iso: string | null, locale: Locale) {
  return iso ? new Date(iso).toLocaleDateString(intlLocale(locale)) : null;
}

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  const t = useMessages("admin").announcements;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      disabled={disabled}
      title={on ? t.toggleOff : t.toggleOn}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${on ? "bg-brand" : "bg-muted"}`}
    >
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export default function AdminAnnouncementsPage() {
  const t = useMessages("admin").announcements;
  const { locale } = useLocale();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: KEY, queryFn: superAdminApi.getAnnouncements });
  const [modal, setModal] = useState<AdminAnnouncement | "new" | null>(null);

  const toggleM = useMutation({
    mutationFn: (a: AdminAnnouncement) => superAdminApi.toggleAnnouncement(a.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => superAdminApi.deleteAnnouncement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button type="button" onClick={() => setModal("new")}>
          <Plus className="size-4" /> {t.create}
        </Button>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message={t.empty} />}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((a) => {
            const published = a.status === "published";
            return (
              <div key={a.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                    <Megaphone className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{a.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          published ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {published ? t.published : t.draft}
                      </span>
                      <span className="rounded-full bg-app px-2 py-0.5 text-[10px] text-muted-foreground">
                        {(t.audience as Record<string, string>)[a.audience] ?? a.audience}
                      </span>
                    </div>
                    {a.body && <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>}
                    {fmtDate(a.publishedAt, locale) && (
                      <p className="mt-1 text-xs text-muted-foreground">{interp(t.publishedAt, { date: fmtDate(a.publishedAt, locale) ?? "" })}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Toggle on={published} onClick={() => toggleM.mutate(a)} disabled={toggleM.isPending} />
                    <button
                      type="button"
                      aria-label={t.editAria}
                      onClick={() => setModal(a)}
                      className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-app hover:text-brand"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={t.deleteAria}
                      onClick={() => {
                        if (window.confirm(interp(t.deleteConfirm, { title: a.title }))) delM.mutate(a.id);
                      }}
                      className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && <AnnouncementModal item={modal === "new" ? undefined : modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function AnnouncementModal({ item, onClose }: { item?: AdminAnnouncement; onClose: () => void }) {
  const t = useMessages("admin").announcements;
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: item?.title ?? "",
    body: item?.body ?? "",
    audience: item?.audience ?? "all",
    status: item?.status ?? "draft",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { title: form.title.trim(), body: form.body ?? "", audience: form.audience, status: form.status };
      return item ? superAdminApi.updateAnnouncement(item.id, payload) : superAdminApi.createAnnouncement(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal
      title={item ? t.editTitle : t.addTitle}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" onClick={() => mutation.mutate()} disabled={!form.title.trim() || mutation.isPending}>
            {mutation.isPending ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="an-title">{t.titleLabel}</Label>
          <Input id="an-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={t.titlePlaceholder} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="an-body">{t.bodyLabel}</Label>
          <textarea
            id="an-body"
            value={form.body ?? ""}
            onChange={(e) => set("body", e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring"
            placeholder={t.bodyPlaceholder}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="an-audience">{t.audienceLabel}</Label>
            <select
              id="an-audience"
              value={form.audience}
              onChange={(e) => set("audience", e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
            >
              <option value="all">{t.audience.all}</option>
              <option value="trial">{t.audience.trial}</option>
              <option value="paid">{t.audience.paid}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="an-status">{t.statusLabel}</Label>
            <select
              id="an-status"
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
            >
              <option value="draft">{t.statusDraft}</option>
              <option value="published">{t.statusPublished}</option>
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
}
