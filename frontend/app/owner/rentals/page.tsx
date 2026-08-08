"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageOff, Package, Plus, Trash2 } from "lucide-react";
import type { OutstandingRental, RentalItem, RentalItemInput } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { RowActions, rowAction } from "@/components/ui/row-action";

const KEY = ["owner", "rental-items"];
const fmt = new Intl.NumberFormat("th-TH");

const UNIT_LABEL: Record<string, string> = {
  per_session: "ต่อครั้ง",
  per_hour: "ต่อชั่วโมง",
};

/**
 * Equipment the venue lends out.
 *
 * `stockQty` here is how many the venue **owns** — what is free depends on the
 * hours being asked about, which is why the "กำลังถูกยืม" panel below is by day
 * rather than a single remaining number.
 */
export default function OwnerRentalsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: KEY, queryFn: ownerApi.getRentalItems });
  const [editing, setEditing] = useState<RentalItem | "new" | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: KEY });
  const items = data ?? [];

  if (isLoading) return <Loading rows={4} />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">อุปกรณ์ให้เช่า</h1>
          <p className="text-sm text-muted-foreground">
            ลูกค้าเลือกเช่าได้ตั้งแต่หน้าจอง · จำนวนที่ว่างคิดตามช่วงเวลาที่จองอัตโนมัติ
          </p>
        </div>
        <Button type="button" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> เพิ่มอุปกรณ์
        </Button>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 bg-white p-10 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand">
            <Package className="size-6" />
          </div>
          <p className="mt-3 font-semibold">ยังไม่มีอุปกรณ์ให้เช่า</p>
          <p className="mt-0.5 text-sm text-muted-foreground">เช่น ไม้แบด รองเท้า เครื่องยิงลูก</p>
          <Button type="button" className="mt-4" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> เพิ่มอุปกรณ์แรก
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[720px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="w-20 px-4 py-3">รูป</th>
                  <th className="px-4 py-3">อุปกรณ์</th>
                  <th className="px-4 py-3 text-right">ราคา</th>
                  <th className="px-4 py-3">มีทั้งหมด</th>
                  <th className="w-48 px-4 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {items.map((item) => (
                  <ItemRow key={item.id} item={item} onEdit={() => setEditing(item)} onChanged={refresh} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NotBackYet />

      <OutToday />

      {editing && (
        <ItemEditor
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

/**
 * Gear whose booking has ended and which never came back.
 *
 * Different question from OutToday: that one is "what is in use right now",
 * this one is "who do we have to call". Only shown when there is something to
 * chase, so a clean counter never sees an empty scary panel.
 */
function NotBackYet() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["owner", "rentals", "outstanding"],
    queryFn: ownerApi.getOutstandingRentals,
  });

  const take = useMutation({
    mutationFn: (row: OutstandingRental) => ownerApi.returnRental(row.bookingId, row.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner", "rentals", "outstanding"] });
      qc.invalidateQueries({ queryKey: ["owner", "bookings"] });
    },
  });

  const rows = data ?? [];
  if (rows.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <header className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
        <h2 className="font-semibold">ยังไม่ได้คืน</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
          {rows.length}
        </span>
        <span className="text-xs text-muted-foreground">— เลยเวลาจองแล้วแต่อุปกรณ์ยังไม่กลับมา</span>
      </header>

      <div className="overflow-x-auto">
        <table className="stack-table w-full md:min-w-[720px] text-sm">
          <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-3">อุปกรณ์</th>
              <th className="px-4 py-3">ลูกค้า</th>
              <th className="px-4 py-3">การจอง</th>
              <th className="px-4 py-3 text-right">ค้างอยู่</th>
              <th className="w-40 px-4 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-app/60">
                <td data-label="อุปกรณ์" className="px-4 py-3 font-medium">{r.name}</td>
                <td data-label="ลูกค้า" className="px-4 py-3">{r.customerName}</td>
                <td data-label="การจอง" className="px-4 py-3 text-muted-foreground">
                  <div className="font-mono text-xs">{r.bookingCode}</div>
                  <div>{r.date} · {r.start}–{r.end}</div>
                </td>
                <td data-label="ค้างอยู่" className="px-4 py-3 text-right font-semibold text-amber-700">
                  {r.outstandingQty} / {r.quantity}
                </td>
                <td className="px-4 py-3">
                  <RowActions>
                    <button
                      type="button"
                      disabled={take.isPending}
                      onClick={() => take.mutate(r)}
                      className={rowAction()}
                    >
                      รับคืนครบ
                    </button>
                  </RowActions>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {take.isError && (
        <p className="px-4 py-2 text-sm text-brand-danger">{(take.error as Error).message}</p>
      )}
    </section>
  );
}

/** What is out today, and with whom — the question asked at the counter. */
function OutToday() {
  const { data } = useQuery({ queryKey: ["owner", "rentals-out"], queryFn: () => ownerApi.getRentalsOut() });

  if (!data || data.data.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <header className="border-b border-black/5 px-4 py-3">
        <h2 className="font-semibold">กำลังถูกยืมวันนี้</h2>
        <p className="text-xs text-muted-foreground">ตามการจองของวันที่ {data.date}</p>
      </header>
      <ul className="divide-y divide-black/5">
        {data.data.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="min-w-0 flex-1">
              <span className="font-medium">{r.name}</span> × {r.quantity}
              <span className="block text-xs text-muted-foreground">
                {r.customerName ?? "ลูกค้า"} · {r.courtName} · {r.start}–{r.end}
              </span>
            </span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">{r.bookingCode}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ItemRow({
  item,
  onEdit,
  onChanged,
}: {
  item: RentalItem;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const remove = useMutation({ mutationFn: () => ownerApi.deleteRentalItem(item.id), onSuccess: onChanged });
  const toggle = useMutation({
    mutationFn: () => ownerApi.updateRentalItem(item.id, { isActive: !item.isActive }),
    onSuccess: onChanged,
  });

  return (
    <tr className={`hover:bg-app/60 ${item.isActive ? "" : "opacity-60"}`}>
      <td data-label="รูป" className="px-4 py-3">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="size-12 rounded-lg object-cover ring-1 ring-black/10" />
        ) : (
          <span className="grid size-12 place-items-center rounded-lg bg-app text-muted-foreground">
            <ImageOff className="size-4" />
          </span>
        )}
      </td>
      <td data-label="อุปกรณ์" className="px-4 py-3">
        <div className="font-medium">{item.name}</div>
        <div className="text-xs text-muted-foreground">
          {[item.category, item.note].filter(Boolean).join(" · ") || "—"}
        </div>
      </td>
      <td data-label="ราคา" className="px-4 py-3 text-right">
        <div className="font-semibold text-brand">฿{fmt.format(item.price)}</div>
        <div className="text-xs text-muted-foreground">{UNIT_LABEL[item.priceUnit]}</div>
      </td>
      <td data-label="มีทั้งหมด" className="px-4 py-3 tabular-nums">{fmt.format(item.stockQty)} ชิ้น</td>
      <td data-actions className="px-4 py-3">
        <RowActions>
          <button type="button" onClick={onEdit} className={rowAction()}>
            แก้ไข
          </button>
          <button
            type="button"
            onClick={() => toggle.mutate()}
            disabled={toggle.isPending}
            className={rowAction(item.isActive ? "on" : "off")}
          >
            {item.isActive ? "เปิดให้เช่า" : "ปิดอยู่"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`ลบ ${item.name}? ถ้าแค่หยุดให้เช่าชั่วคราว ให้กดปิดแทน`)) remove.mutate();
            }}
            disabled={remove.isPending}
            aria-label={`ลบ ${item.name}`}
            className={rowAction("icon", "hover:bg-brand-danger/10 hover:text-brand-danger")}
          >
            <Trash2 className="size-4" />
          </button>
        </RowActions>
      </td>
    </tr>
  );
}

function ItemEditor({
  item,
  onClose,
  onSaved,
}: {
  item: RentalItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<RentalItemInput>({
    name: item?.name ?? "",
    category: item?.category ?? "",
    price: item?.price ?? 0,
    priceUnit: item?.priceUnit ?? "per_session",
    stockQty: item?.stockQty ?? 1,
    imageUrl: item?.imageUrl ?? null,
    note: item?.note ?? "",
    isActive: item?.isActive ?? true,
  });

  const [uploading, setUploading] = useState(false);
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const url = await ownerApi.uploadImage(file);
      setForm((f) => ({ ...f, imageUrl: url }));
    } finally {
      setUploading(false);
    }
  }

  const save = useMutation({
    mutationFn: () => (item ? ownerApi.updateRentalItem(item.id, form) : ownerApi.createRentalItem(form)),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  const valid = (form.name ?? "").trim().length > 0 && Number(form.price) >= 0;

  return (
    <Modal
      title={item ? "แก้ไขอุปกรณ์" : "เพิ่มอุปกรณ์"}
      onClose={onClose}
      footer={
        <>
          {save.isError && (
            <span className="mr-auto self-center text-sm text-brand-danger">
              {(save.error as Error).message}
            </span>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="button" onClick={() => save.mutate()} disabled={!valid || save.isPending || uploading}>
            {save.isPending ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="r-name">ชื่ออุปกรณ์</Label>
          <Input
            id="r-name"
            value={form.name ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="เช่น ไม้แบดมินตัน"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="r-price">ราคา (บาท)</Label>
            <Input
              id="r-price"
              type="number"
              min={0}
              value={form.price ?? 0}
              onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-unit">คิดราคาแบบ</Label>
            <select
              id="r-unit"
              value={form.priceUnit}
              onChange={(e) =>
                setForm((f) => ({ ...f, priceUnit: e.target.value as RentalItemInput["priceUnit"] }))
              }
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
            >
              <option value="per_session">ต่อครั้ง (จ่ายครั้งเดียว)</option>
              <option value="per_hour">ต่อชั่วโมง (คูณตามเวลาที่จอง)</option>
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="r-stock">มีทั้งหมดกี่ชิ้น</Label>
            <Input
              id="r-stock"
              type="number"
              min={0}
              value={form.stockQty ?? 0}
              onChange={(e) => setForm((f) => ({ ...f, stockQty: Number(e.target.value) }))}
            />
            <p className="text-xs text-muted-foreground">
              จำนวนที่สนามมี — ระบบจะคิดให้เองว่าช่วงเวลาไหนเหลือกี่ชิ้น
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-category">หมวด (ไม่บังคับ)</Label>
            <Input
              id="r-category"
              value={form.category ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="ไม้ / รองเท้า / อื่น ๆ"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="r-note">หมายเหตุถึงลูกค้า (ไม่บังคับ)</Label>
          <Input
            id="r-note"
            value={form.note ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="เช่น มัดจำ 500 บาท คืนเมื่อส่งคืน"
          />
        </div>

        <div className="space-y-2">
          <Label>รูป (ไม่บังคับ)</Label>
          <div className="flex items-center gap-3">
            {form.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.imageUrl} alt="" className="size-16 rounded-xl object-cover ring-1 ring-black/10" />
            ) : (
              <span className="grid size-16 place-items-center rounded-xl bg-app text-muted-foreground">
                <ImageOff className="size-5" />
              </span>
            )}
            <label className="cursor-pointer rounded-lg border border-input px-3 py-1.5 text-sm hover:bg-app">
              {uploading ? "กำลังอัปโหลด..." : form.imageUrl ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
              <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={uploading} />
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
}
