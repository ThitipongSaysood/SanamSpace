"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ImageOff, Maximize2, Megaphone, Plus, Trash2 } from "lucide-react";
import type { OwnerWelcomeBanner, WelcomeBannerInput } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState } from "@/components/states";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { ImageLightbox } from "@/components/image-lightbox";
import { RowActions, rowAction } from "@/components/ui/row-action";
import { useMessages } from "@/lib/i18n/context";
import { fmt as interp } from "@/lib/i18n/format";

const KEY = ["owner", "welcome-banners"];

/**
 * The venue's announcements for its customers: a list it can grow, order, and
 * switch on and off one at a time.
 *
 * A table rather than stacked forms — a venue with five banners was scrolling
 * past five full-height posters to reach the last one. Editing happens in a
 * dialog, and the image opens full size on its own.
 */
export default function OwnerBannerPage() {
  const t = useMessages("owner").banner;
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: KEY, queryFn: ownerApi.getWelcomeBanners });

  const [editing, setEditing] = useState<OwnerWelcomeBanner | null>(null);
  const [viewing, setViewing] = useState<OwnerWelcomeBanner | null>(null);

  const banners = data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: () => ownerApi.createWelcomeBanner({ title: "", message: "" }),
    onSuccess: (created) => {
      refresh();
      setEditing(created); // straight into the editor — an empty row is not the goal
    },
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => ownerApi.reorderWelcomeBanners(ids),
    onSuccess: (next) => qc.setQueryData(KEY, next),
  });

  /** Swap a banner with its neighbour and send the whole resulting order. */
  function move(index: number, delta: number) {
    const next = [...banners];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    qc.setQueryData(KEY, next); // move now, confirm when the server agrees
    reorder.mutate(next.map((b) => b.id));
  }

  if (isLoading) return <Loading rows={3} />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t.subtitle}
          </p>
        </div>
        <Button type="button" onClick={() => create.mutate()} disabled={create.isPending}>
          <Plus className="size-4" /> {create.isPending ? t.adding : t.add}
        </Button>
      </header>

      {banners.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 bg-white p-10 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand">
            <Megaphone className="size-6" />
          </div>
          <p className="mt-3 font-semibold">{t.empty}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t.emptyHint}
          </p>
          <Button type="button" className="mt-4" onClick={() => create.mutate()} disabled={create.isPending}>
            <Plus className="size-4" /> {t.addFirst}
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="w-24 px-4 py-3">{t.colOrder}</th>
                  <th className="w-24 px-4 py-3">{t.colImage}</th>
                  <th className="px-4 py-3">{t.colContent}</th>
                  <th className="w-24 px-4 py-3">{t.colPopup}</th>
                  <th className="w-28 px-4 py-3">{t.colStatus}</th>
                  <th className="w-40 px-4 py-3 text-right">{t.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {banners.map((banner, i) => (
                  <BannerRow
                    key={banner.id}
                    banner={banner}
                    position={i}
                    total={banners.length}
                    onMove={(delta) => move(i, delta)}
                    onEdit={() => setEditing(banner)}
                    onView={() => setViewing(banner)}
                    onChanged={refresh}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <BannerEditor
          banner={editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
          onView={() => setViewing(editing)}
        />
      )}

      {viewing?.imageUrl && (
        <ImageLightbox
          src={viewing.imageUrl}
          alt={viewing.title ?? t.bannerAlt}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

function BannerRow({
  banner,
  position,
  total,
  onMove,
  onEdit,
  onView,
  onChanged,
}: {
  banner: OwnerWelcomeBanner;
  position: number;
  total: number;
  onMove: (delta: number) => void;
  onEdit: () => void;
  onView: () => void;
  onChanged: () => void;
}) {
  const t = useMessages("owner").banner;
  const toggle = useMutation({
    mutationFn: () => ownerApi.toggleWelcomeBanner(banner.id),
    onSuccess: onChanged,
  });

  const remove = useMutation({
    mutationFn: () => ownerApi.deleteWelcomeBanner(banner.id),
    onSuccess: onChanged,
  });

  const empty = !banner.imageUrl && !banner.title && !banner.message;

  return (
    <tr className={`hover:bg-app/60 ${banner.isActive ? "" : "opacity-60"}`}>
      <td data-label={t.colOrder} className="px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-app text-xs font-semibold text-muted-foreground">
            {position + 1}
          </span>
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={position === 0}
            aria-label={t.moveUp}
            className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-app disabled:opacity-25"
          >
            <ArrowUp className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={position === total - 1}
            aria-label={t.moveDown}
            className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-app disabled:opacity-25"
          >
            <ArrowDown className="size-3.5" />
          </button>
        </div>
      </td>

      <td data-label={t.colImage} className="px-4 py-3">
        {banner.imageUrl ? (
          <button
            type="button"
            onClick={onView}
            aria-label={t.viewFull}
            className="group relative block size-14 overflow-hidden rounded-lg ring-1 ring-black/10"
          >
            {/* Thumbnail is the only place a crop is honest — it is a handle to
                the real thing, not the thing. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner.imageUrl} alt="" className="size-full object-cover" />
            <span className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
              <Maximize2 className="size-4" />
            </span>
          </button>
        ) : (
          <span className="grid size-14 place-items-center rounded-lg bg-app text-muted-foreground">
            <ImageOff className="size-4" />
          </span>
        )}
      </td>

      <td data-label={t.colContent} className="px-4 py-3">
        {empty ? (
          <span className="text-muted-foreground">{t.rowEmpty}</span>
        ) : (
          <>
            <div className="font-medium">{banner.title || t.noTitle}</div>
            {banner.message && (
              <div className="line-clamp-1 max-w-md text-xs text-muted-foreground">{banner.message}</div>
            )}
          </>
        )}
      </td>

      <td data-label={t.colPopup} className="px-4 py-3">
        {banner.popup ? (
          <span className="rounded-full bg-brand-accent/15 px-2 py-0.5 text-xs font-semibold text-brand">
            {t.popupBadge}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{t.dash}</span>
        )}
      </td>

      <td data-label={t.colStatus} className="px-4 py-3">
        {/* The whole reason this is a list: park a banner, keep it. */}
        <button
          type="button"
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
          aria-pressed={banner.isActive}
          className={rowAction(banner.isActive ? "on" : "off")}
        >
          {banner.isActive ? t.active : t.inactive}
        </button>
      </td>

      <td data-actions className="px-4 py-3">
        <RowActions>
          <button type="button" onClick={onEdit} className={rowAction()}>
            {t.edit}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t.deleteConfirm)) remove.mutate();
            }}
            disabled={remove.isPending}
            aria-label={t.deleteAria}
            className={rowAction("icon", "hover:bg-brand-danger/10 hover:text-brand-danger")}
          >
            <Trash2 className="size-4" />
          </button>
        </RowActions>
      </td>
    </tr>
  );
}

/** The full editor for one banner, in a dialog. */
function BannerEditor({
  banner,
  onClose,
  onSaved,
  onView,
}: {
  banner: OwnerWelcomeBanner;
  onClose: () => void;
  onSaved: () => void;
  onView: () => void;
}) {
  const t = useMessages("owner").banner;
  const [form, setForm] = useState<OwnerWelcomeBanner>(banner);

  function set<K extends keyof OwnerWelcomeBanner>(key: K, value: OwnerWelcomeBanner[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const save = useMutation({
    mutationFn: (patch: WelcomeBannerInput) => ownerApi.updateWelcomeBanner(banner.id, patch),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  const [uploading, setUploading] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadFailed(false);
    try {
      set("imageUrl", await ownerApi.uploadImage(file));
    } catch {
      setUploadFailed(true);
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    save.mutate({
      title: form.title,
      message: form.message,
      imageUrl: form.imageUrl,
      link: form.link,
      popup: form.popup,
    });
  }

  return (
    <Modal
      title={t.editTitle}
      width="max-w-3xl"
      onClose={onClose}
      footer={
        <>
          {save.isError && (
            <span className="mr-auto self-center text-sm text-brand-danger">{t.saveFailed}</span>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" onClick={submit} disabled={save.isPending || uploading}>
            {save.isPending ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t.imageLabel}</Label>
            {form.imageUrl ? (
              <button
                type="button"
                onClick={onView}
                className="group relative block w-full overflow-hidden rounded-xl ring-1 ring-black/10"
              >
                {/* Whole image, its own proportions — capped so a tall poster
                    does not push the form off screen. Tap for the real size. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.imageUrl} alt={t.editorAlt} className="mx-auto block h-auto max-h-64 w-auto max-w-full" />
                <span className="absolute right-2 top-2 grid size-8 place-items-center rounded-lg bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
                  <Maximize2 className="size-4" />
                </span>
              </button>
            ) : (
              <div className="grid aspect-[16/7] w-full place-items-center rounded-xl border border-dashed border-black/15 text-sm text-muted-foreground">
                {t.noImage}
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-input px-3 py-1.5 text-sm hover:bg-app">
                {uploading ? t.uploading : form.imageUrl ? t.changeImage : t.uploadImage}
                <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={uploading} />
              </label>
              {form.imageUrl && (
                <button
                  type="button"
                  onClick={() => set("imageUrl", null)}
                  className="text-xs text-muted-foreground hover:text-brand-danger"
                >
                  {t.removeImage}
                </button>
              )}
            </div>
            {uploadFailed && <p className="text-xs text-brand-danger">{t.uploadFailed}</p>}
            <p className="text-xs text-muted-foreground">
              {t.imageHint}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="b-title">{t.titleLabel}</Label>
            <Input
              id="b-title"
              value={form.title ?? ""}
              onChange={(e) => set("title", e.target.value)}
              placeholder={t.titlePlaceholder}
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="b-message">{t.messageLabel}</Label>
            <textarea
              id="b-message"
              rows={4}
              value={form.message ?? ""}
              onChange={(e) => set("message", e.target.value)}
              placeholder={t.messagePlaceholder}
              maxLength={500}
              className="w-full rounded-xl border border-input bg-white p-3 text-sm outline-none focus-visible:border-ring"
            />
            <p className="text-xs text-muted-foreground">{interp(t.charCount, { n: (form.message ?? "").length })}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="b-link">{t.linkLabel}</Label>
            <Input
              id="b-link"
              value={form.link ?? ""}
              onChange={(e) => set("link", e.target.value)}
              placeholder={t.linkPlaceholder}
            />
          </div>

          <div className="flex items-start justify-between gap-3 rounded-xl bg-app p-3">
            <div className="text-sm">
              {t.popupLabel}
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t.popupHint}
              </span>
            </div>
            <Switch
              checked={form.popup}
              onCheckedChange={(v) => set("popup", v)}
              aria-label={t.popupLabel}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

