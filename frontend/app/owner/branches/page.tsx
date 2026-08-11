"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Clock,
  Image as ImageIcon,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Power,
  Trash2,
  X,
} from "lucide-react";
import type { OwnerBranch } from "@/lib/types";
import { ownerApi, type BranchInput } from "@/lib/api/owner";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BRANCHES_KEY = ["owner", "branches"];

const FACILITIES: { key: string; label: string }[] = [
  { key: "parking", label: "ที่จอดรถ" },
  { key: "shower", label: "ห้องอาบน้ำ" },
  { key: "cafe", label: "คาเฟ่" },
  { key: "wifi", label: "Wi-Fi" },
  { key: "aircon", label: "ห้องแอร์" },
  { key: "locker", label: "ล็อกเกอร์" },
  { key: "shop", label: "ร้านค้า" },
  { key: "restroom", label: "ห้องน้ำ" },
];

const DAYS = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];

export default function OwnerBranchesPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: BRANCHES_KEY,
    queryFn: ownerApi.getBranches,
  });
  // null = list · "new" = create · OwnerBranch = edit. The form renders
  // full-width (outside the card grid) so it never gets cramped in a cell.
  const [editing, setEditing] = useState<OwnerBranch | "new" | null>(null);

  if (editing) {
    return (
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">
            {editing === "new" ? "เพิ่มสนาม" : "แก้ไขสนาม"}
          </h1>
          <p className="text-sm text-muted-foreground">จัดการเนื้อหาสนามที่แสดงให้ลูกค้า</p>
        </header>
        <BranchForm
          branch={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">สนาม</h1>
          <p className="text-sm text-muted-foreground">
            จัดการเนื้อหาสนามที่แสดงให้ลูกค้า — เพิ่ม / แก้ไข / ลบ / เปิด-ปิด
          </p>
        </div>
        <Button type="button" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> เพิ่มสนาม
        </Button>
      </header>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มีสนาม" />}

      {data && data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((b) => (
            <BranchCard key={b.id} branch={b} onEdit={() => setEditing(b)} />
          ))}
        </div>
      )}
    </div>
  );
}

type FormState = {
  name: string;
  address: string;
  phone: string;
  sports: string[];
  openTime: string;
  closeTime: string;
  description: string;
  travelHint: string;
  peakNote: string;
  imageUrl: string;
  planImageUrl: string;
  facilities: string[];
  photos: string[];
  weekHours: { day: string; open: string; close: string }[];
};

function initialForm(branch?: OwnerBranch): FormState {
  const wh = DAYS.map((day) => {
    const found = branch?.weekHours?.find((h) => h.day === day);
    return { day, open: found?.open ?? "", close: found?.close ?? "" };
  });
  return {
    name: branch?.name ?? "",
    address: branch?.address ?? "",
    phone: branch?.phone ?? "",
    sports: branch?.sports ?? [],
    openTime: branch?.openTime ?? "",
    closeTime: branch?.closeTime ?? "",
    description: branch?.description ?? "",
    travelHint: branch?.travelHint ?? "",
    peakNote: branch?.peakNote ?? "",
    imageUrl: branch?.imageUrl ?? "",
    planImageUrl: branch?.planImageUrl ?? "",
    facilities: branch?.facilities ?? [],
    photos: branch?.photos ?? [],
    weekHours: wh,
  };
}

function BranchForm({ branch, onClose }: { branch?: OwnerBranch; onClose: () => void }) {
  const qc = useQueryClient();
  const sports = useQuery({ queryKey: ["owner", "sports"], queryFn: ownerApi.getSports });
  const [form, setForm] = useState<FormState>(() => initialForm(branch));
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const mutation = useMutation({
    mutationFn: () => {
      const payload: BranchInput = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        openTime: form.openTime || null,
        closeTime: form.closeTime || null,
        sports: form.sports,
        facilities: form.facilities,
        imageUrl: form.imageUrl || null,
        planImageUrl: form.planImageUrl || null,
        photos: form.photos,
        description: form.description.trim() || null,
        travelHint: form.travelHint.trim() || null,
        peakNote: form.peakNote.trim() || null,
        weekHours: form.weekHours.filter((h) => h.open || h.close),
      };
      return branch ? ownerApi.updateBranch(branch.id, payload) : ownerApi.createBranch(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BRANCHES_KEY });
      onClose();
    },
  });

  const valid = form.name.trim() !== "";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (valid) mutation.mutate();
  }

  function toggleFacility(key: string) {
    setForm((f) => ({
      ...f,
      facilities: f.facilities.includes(key)
        ? f.facilities.filter((k) => k !== key)
        : [...f.facilities, key],
    }));
  }

  const [formTab, setFormTab] = useState<"general" | "media" | "hours">("general");

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{branch ? "แก้ไขสนาม" : "เพิ่มสนาม"}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-app"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* แท็บ (เหมือนหน้า Settings) */}
      <div className="flex flex-wrap gap-1 border-b border-black/5">
        {(
          [
            { key: "general", label: "ข้อมูลทั่วไป" },
            { key: "media", label: "รูปภาพ & แผนผัง" },
            { key: "hours", label: "เวลาทำการ" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFormTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              formTab === t.key
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== แท็บ: ข้อมูลทั่วไป ===== */}
      {formTab === "general" && (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="b-name">ชื่อสนาม</Label>
              <Input id="b-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="เช่น Everyday Badminton" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="b-address">ที่อยู่</Label>
              <Input id="b-address" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="123 ถ.สุขุมวิท กรุงเทพฯ" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-phone">เบอร์โทร</Label>
              <Input id="b-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="081-234-5678" />
            </div>
            {/*
              * Picked, not typed.
              *
              * This was a text box the owner typed comma-separated keys into,
              * and it is what decides the customer app's loading screen and
              * its notification icon. A word the platform did not know was
              * dropped in silence and the venue fell back to badminton — so a
              * tennis venue showed its customers a shuttlecock, with nothing
              * anywhere saying why. There was no list of valid words either;
              * the only hint was the placeholder.
              */}
            <div className="space-y-1.5 md:col-span-2">
              <Label>กีฬาที่เปิดให้บริการ</Label>
              <div className="flex flex-wrap gap-2">
                {(sports.data ?? []).map((sport) => {
                  const on = form.sports.includes(sport.key);
                  return (
                    <button
                      key={sport.key}
                      type="button"
                      onClick={() =>
                        set("sports", on ? form.sports.filter((k) => k !== sport.key) : [...form.sports, sport.key])
                      }
                      aria-pressed={on}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                        on
                          ? "border-brand bg-brand/10 font-medium text-brand"
                          : "border-input text-muted-foreground hover:border-brand/40"
                      }`}
                    >
                      <span aria-hidden>{sport.emoji}</span>
                      {sport.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                ตัวแรกที่เลือกคือกีฬาหลัก ใช้เป็นไอคอนแจ้งเตือนของแอปลูกค้า
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-open">เวลาเปิด (ทั่วไป)</Label>
              <Input id="b-open" type="time" value={form.openTime} onChange={(e) => set("openTime", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-close">เวลาปิด (ทั่วไป)</Label>
              <Input id="b-close" type="time" value={form.closeTime} onChange={(e) => set("closeTime", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-travel">การเดินทาง</Label>
              <Input id="b-travel" value={form.travelHint} onChange={(e) => set("travelHint", e.target.value)} placeholder="15 นาทีจาก MRT บางรักน้อย" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-peak">หมายเหตุช่วงพีค</Label>
              <Input id="b-peak" value={form.peakNote} onChange={(e) => set("peakNote", e.target.value)} placeholder="พีค 18:00–21:00" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="b-desc">เกี่ยวกับสนาม</Label>
              <textarea
                id="b-desc"
                rows={3}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="รายละเอียดสนาม สิ่งที่น่าสนใจ..."
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </section>

          <section className="space-y-2">
            <Label>สิ่งอำนวยความสะดวก</Label>
            <div className="flex flex-wrap gap-2">
              {FACILITIES.map((f) => {
                const on = form.facilities.includes(f.key);
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => toggleFacility(f.key)}
                    aria-pressed={on}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition ${
                      on
                        ? "bg-brand text-brand-foreground ring-brand"
                        : "bg-white text-muted-foreground ring-black/10 hover:bg-app"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* ===== แท็บ: รูปภาพ & แผนผัง ===== */}
      {formTab === "media" && (
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2">
            <ImageField label="รูปปกสนาม" value={form.imageUrl} onChange={(url) => set("imageUrl", url)} />
            <ImageField label="แผนผังสนาม (floor-plan)" value={form.planImageUrl} onChange={(url) => set("planImageUrl", url)} />
          </section>
          <PhotosField photos={form.photos} onChange={(photos) => set("photos", photos)} />
        </div>
      )}

      {/* ===== แท็บ: เวลาทำการ ===== */}
      {formTab === "hours" && (
        <section className="space-y-2">
          <Label>เวลาเปิด-ปิด รายวัน (ไม่บังคับ)</Label>
          <div className="space-y-1.5">
            {form.weekHours.map((h, i) => (
              <div key={h.day} className="flex items-center gap-2">
                <span className="w-20 text-sm text-muted-foreground">{h.day}</span>
                <Input
                  type="time"
                  value={h.open}
                  onChange={(e) =>
                    setForm((f) => {
                      const wh = [...f.weekHours];
                      wh[i] = { ...wh[i], open: e.target.value };
                      return { ...f, weekHours: wh };
                    })
                  }
                  className="max-w-[120px]"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="time"
                  value={h.close}
                  onChange={(e) =>
                    setForm((f) => {
                      const wh = [...f.weekHours];
                      wh[i] = { ...wh[i], close: e.target.value };
                      return { ...f, weekHours: wh };
                    })
                  }
                  className="max-w-[120px]"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {mutation.isError && <p className="text-sm text-brand-danger">บันทึกไม่สำเร็จ ลองอีกครั้ง</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={mutation.isPending || !valid}>
          {mutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}

// Single-image upload field (cover / floor-plan).
function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setErr(false);
    try {
      onChange(await ownerApi.uploadImage(file));
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="size-16 rounded-lg object-cover ring-1 ring-black/10" />
        ) : (
          <div className="grid size-16 place-items-center rounded-lg bg-app text-muted-foreground ring-1 ring-black/10">
            <ImageIcon className="size-5" />
          </div>
        )}
        <label className="cursor-pointer rounded-lg border border-input px-3 py-1.5 text-sm hover:bg-app">
          {busy ? "กำลังอัปโหลด..." : "อัปโหลด"}
          <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-sm text-muted-foreground hover:text-brand-danger"
          >
            ลบ
          </button>
        )}
      </div>
      {err && <p className="text-xs text-brand-danger">อัปโหลดไม่สำเร็จ</p>}
    </div>
  );
}

// Multi-image gallery upload field.
function PhotosField({
  photos,
  onChange,
}: {
  photos: string[];
  onChange: (photos: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      const urls = await Promise.all(files.map((f) => ownerApi.uploadImage(f)));
      onChange([...photos, ...urls]);
    } catch {
      /* ignore individual failures */
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2">
      <Label>รูปภาพสนาม (แกลเลอรี)</Label>
      <div className="flex flex-wrap gap-2">
        {photos.map((url, i) => (
          <div key={`${url}-${i}`} className="relative size-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="size-20 rounded-lg object-cover ring-1 ring-black/10" />
            <button
              type="button"
              onClick={() => onChange(photos.filter((_, j) => j !== i))}
              aria-label="ลบรูป"
              className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-brand-danger text-white"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        <label className="grid size-20 cursor-pointer place-items-center rounded-lg border border-dashed border-input text-muted-foreground hover:bg-app">
          {busy ? <span className="text-xs">...</span> : <Plus className="size-5" />}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onFile}
            disabled={busy}
          />
        </label>
      </div>
    </section>
  );
}

function BranchCard({ branch, onEdit }: { branch: OwnerBranch; onEdit: () => void }) {
  const qc = useQueryClient();

  const toggle = useMutation({
    mutationFn: () => ownerApi.toggleBranch(branch.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: BRANCHES_KEY }),
  });
  const del = useMutation({
    mutationFn: () => ownerApi.deleteBranch(branch.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: BRANCHES_KEY }),
  });

  function onDelete() {
    if (window.confirm(`ลบสนาม "${branch.name}" ?`)) del.mutate();
  }

  const closed = branch.status !== "active";

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="relative h-28 bg-app">
        {branch.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branch.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <Building2 className="size-7" />
          </div>
        )}
        <span
          className={`absolute right-2 top-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            closed ? "bg-black/50 text-white" : "bg-emerald-500 text-white"
          }`}
        >
          {closed ? "ปิด" : "เปิด"}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="font-semibold">{branch.name}</div>
        <div className="mt-1 flex-1 space-y-1">
          {branch.address && (
            <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              <span className="line-clamp-2">{branch.address}</span>
            </div>
          )}
          {branch.phone && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Phone className="size-3.5 shrink-0" />
              <span>{branch.phone}</span>
            </div>
          )}
          {(branch.openTime || branch.closeTime) && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="size-3.5 shrink-0" />
              <span>
                {branch.openTime ?? "—"} - {branch.closeTime ?? "—"}
              </span>
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            {branch.courtCount} คอร์ท · {branch.facilities.length} สิ่งอำนวยความสะดวก ·{" "}
            {branch.photos.length} รูป
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-black/5 pt-3">
          <Button type="button" size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="size-4" /> แก้ไข
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => toggle.mutate()}
            disabled={toggle.isPending}
          >
            <Power className="size-4" /> {closed ? "เปิด" : "ปิด"}
          </Button>
          <button
            type="button"
            onClick={onDelete}
            disabled={del.isPending}
            aria-label="ลบสนาม"
            className="ml-auto grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-app hover:text-brand-danger disabled:opacity-50"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
