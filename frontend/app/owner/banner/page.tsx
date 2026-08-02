"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ImageOff, Maximize2, Megaphone, Plus, Trash2 } from "lucide-react";
import type { OwnerWelcomeBanner, WelcomeBannerInput } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { ImageLightbox } from "@/components/image-lightbox";

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
          <h1 className="text-2xl font-bold tracking-tight">ข้อความต้อนรับ / แบนเนอร์</h1>
          <p className="text-sm text-muted-foreground">
            แสดงบนหน้าแรกของลูกค้า ตามลำดับในตาราง — เพิ่มได้หลายอัน ปิดไว้ก่อนก็ได้ ไม่ต้องลบทิ้ง
          </p>
        </div>
        <Button type="button" onClick={() => create.mutate()} disabled={create.isPending}>
          <Plus className="size-4" /> {create.isPending ? "กำลังเพิ่ม..." : "เพิ่มแบนเนอร์"}
        </Button>
      </header>

      {banners.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 bg-white p-10 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand">
            <Megaphone className="size-6" />
          </div>
          <p className="mt-3 font-semibold">ยังไม่มีแบนเนอร์</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            ใช้ประกาศเรื่องสำคัญ เช่น วันหยุด เวลาทำการพิเศษ หรือโปรโมชั่น
          </p>
          <Button type="button" className="mt-4" onClick={() => create.mutate()} disabled={create.isPending}>
            <Plus className="size-4" /> เพิ่มแบนเนอร์แรก
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="w-24 px-4 py-3">ลำดับ</th>
                  <th className="w-24 px-4 py-3">รูป</th>
                  <th className="px-4 py-3">หัวข้อ / รายละเอียด</th>
                  <th className="w-24 px-4 py-3">Popup</th>
                  <th className="w-28 px-4 py-3">สถานะ</th>
                  <th className="w-40 px-4 py-3 text-right">จัดการ</th>
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
          alt={viewing.title ?? "แบนเนอร์ของสนาม"}
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
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-app text-xs font-semibold text-muted-foreground">
            {position + 1}
          </span>
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={position === 0}
            aria-label="เลื่อนขึ้น"
            className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-app disabled:opacity-25"
          >
            <ArrowUp className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={position === total - 1}
            aria-label="เลื่อนลง"
            className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-app disabled:opacity-25"
          >
            <ArrowDown className="size-3.5" />
          </button>
        </div>
      </td>

      <td className="px-4 py-3">
        {banner.imageUrl ? (
          <button
            type="button"
            onClick={onView}
            aria-label="ดูรูปเต็ม"
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

      <td className="px-4 py-3">
        {empty ? (
          <span className="text-muted-foreground">(ว่าง — ลูกค้าจะไม่เห็นการ์ดนี้)</span>
        ) : (
          <>
            <div className="font-medium">{banner.title || "(ไม่มีหัวข้อ)"}</div>
            {banner.message && (
              <div className="line-clamp-1 max-w-md text-xs text-muted-foreground">{banner.message}</div>
            )}
          </>
        )}
      </td>

      <td className="px-4 py-3">
        {banner.popup ? (
          <span className="rounded-full bg-brand-accent/15 px-2 py-0.5 text-xs font-semibold text-brand">
            เด้ง
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      <td className="px-4 py-3">
        {/* The whole reason this is a list: park a banner, keep it. */}
        <button
          type="button"
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
          aria-pressed={banner.isActive}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
            banner.isActive ? "bg-brand/10 text-brand" : "bg-app text-muted-foreground"
          }`}
        >
          {banner.isActive ? "เปิดอยู่" : "ปิดอยู่"}
        </button>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-input px-2.5 py-1 text-xs font-medium hover:bg-app"
          >
            แก้ไข
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("ลบแบนเนอร์นี้? ถ้าแค่อยากซ่อนชั่วคราว ให้กด “ปิดอยู่” แทน")) remove.mutate();
            }}
            disabled={remove.isPending}
            aria-label="ลบแบนเนอร์"
            className="grid size-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-brand-danger/10 hover:text-brand-danger"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
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
      title="แก้ไขแบนเนอร์"
      width="max-w-3xl"
      onClose={onClose}
      footer={
        <>
          {save.isError && (
            <span className="mr-auto self-center text-sm text-brand-danger">บันทึกไม่สำเร็จ ลองอีกครั้ง</span>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="button" onClick={submit} disabled={save.isPending || uploading}>
            {save.isPending ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>รูปแบนเนอร์</Label>
            {form.imageUrl ? (
              <button
                type="button"
                onClick={onView}
                className="group relative block w-full overflow-hidden rounded-xl ring-1 ring-black/10"
              >
                {/* Whole image, its own proportions — capped so a tall poster
                    does not push the form off screen. Tap for the real size. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.imageUrl} alt="แบนเนอร์" className="mx-auto block h-auto max-h-64 w-auto max-w-full" />
                <span className="absolute right-2 top-2 grid size-8 place-items-center rounded-lg bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
                  <Maximize2 className="size-4" />
                </span>
              </button>
            ) : (
              <div className="grid aspect-[16/7] w-full place-items-center rounded-xl border border-dashed border-black/15 text-sm text-muted-foreground">
                ยังไม่มีรูป
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-input px-3 py-1.5 text-sm hover:bg-app">
                {uploading ? "กำลังอัปโหลด..." : form.imageUrl ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
                <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={uploading} />
              </label>
              {form.imageUrl && (
                <button
                  type="button"
                  onClick={() => set("imageUrl", null)}
                  className="text-xs text-muted-foreground hover:text-brand-danger"
                >
                  ลบรูป
                </button>
              )}
            </div>
            {uploadFailed && <p className="text-xs text-brand-danger">อัปโหลดไม่สำเร็จ</p>}
            <p className="text-xs text-muted-foreground">
              แสดงตามสัดส่วนของไฟล์ ไม่ตัดขอบ · แนะนำกว้าง 1200px ขึ้นไป · ไม่เกิน 5MB
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="b-title">หัวข้อ</Label>
            <Input
              id="b-title"
              value={form.title ?? ""}
              onChange={(e) => set("title", e.target.value)}
              placeholder="เช่น ยินดีต้อนรับสู่สนามของเรา"
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="b-message">รายละเอียด</Label>
            <textarea
              id="b-message"
              rows={4}
              value={form.message ?? ""}
              onChange={(e) => set("message", e.target.value)}
              placeholder="เช่น เปิดทุกวัน 10:00–22:00 · จองล่วงหน้าได้ 7 วัน"
              maxLength={500}
              className="w-full rounded-xl border border-input bg-white p-3 text-sm outline-none focus-visible:border-ring"
            />
            <p className="text-xs text-muted-foreground">{(form.message ?? "").length}/500 ตัวอักษร</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="b-link">ลิงก์เมื่อกดแบนเนอร์ (ไม่บังคับ)</Label>
            <Input
              id="b-link"
              value={form.link ?? ""}
              onChange={(e) => set("link", e.target.value)}
              placeholder="https://... เว้นว่าง = กดไม่ได้"
            />
          </div>

          <label className="flex items-start gap-3 rounded-xl bg-app p-3">
            <input
              type="checkbox"
              checked={form.popup}
              onChange={(e) => set("popup", e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--brand-primary)]"
            />
            <span className="text-sm">
              เด้งเป็น popup ตอนลูกค้าเข้าแอป
              <span className="mt-0.5 block text-xs text-muted-foreground">
                ลูกค้าปิดแล้วจะไม่เด้งซ้ำ จนกว่าจะเปลี่ยนรูปหรือข้อความ — เปิดหลายอันได้ ลูกค้าจะกด “ถัดไป” ดูทีละอัน
              </span>
            </span>
          </label>
        </div>
      </div>
    </Modal>
  );
}

