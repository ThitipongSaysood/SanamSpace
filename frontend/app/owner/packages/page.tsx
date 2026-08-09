"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import type { OwnerVenuePackage } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { RowActions, rowAction } from "@/components/ui/row-action";

const KEY = ["owner", "venue-packages"];
const fmt = new Intl.NumberFormat("th-TH");

/**
 * The hour packages the venue sells to its customers.
 *
 * Not the venue's own subscription — that is "แพ็กเกจ/ต่ออายุ", which is what
 * the venue pays SanamSpace. Two different things wearing the same word, so
 * both screens say which one they are.
 *
 * Customers could browse and buy these from day one; the venue could not add,
 * reprice or retire a single one of them.
 */
export default function OwnerPackagesPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: KEY, queryFn: ownerApi.getVenuePackages });
  const [editing, setEditing] = useState<OwnerVenuePackage | "new" | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => ownerApi.deleteVenuePackage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const packages = data ?? [];

  if (isLoading) return <Loading rows={4} />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">แพ็กเกจชั่วโมง</h1>
          <p className="text-sm text-muted-foreground">
            ขายชั่วโมงล่วงหน้าให้ลูกค้า ใช้กับค่าสนาม · คนละอย่างกับ<strong>เครดิต</strong>ที่เป็นเงินบาท
          </p>
        </div>
        <Button type="button" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> เพิ่มแพ็กเกจ
        </Button>
      </header>

      {packages.length === 0 ? (
        <EmptyState message="ยังไม่มีแพ็กเกจขาย" />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[760px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">แพ็กเกจ</th>
                  <th className="px-4 py-3 text-right">ชั่วโมง</th>
                  <th className="px-4 py-3 text-right">ราคา</th>
                  <th className="px-4 py-3 text-right">ตกชั่วโมงละ</th>
                  <th className="px-4 py-3">อายุ</th>
                  <th className="px-4 py-3 text-right">คนถืออยู่</th>
                  <th className="w-36 px-4 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {packages.map((p) => (
                  <tr key={p.id} className="hover:bg-app/60">
                    <td data-label="แพ็กเกจ" className="px-4 py-3">
                      <div className="font-medium">{p.name}</div>
                      {/* Computed from the venue's own cheapest court, not typed
                          in — an advertised saving nobody checked is a claim. */}
                      {p.savePercent > 0 && (
                        <div className="text-xs text-emerald-700">ประหยัด {p.savePercent}%</div>
                      )}
                    </td>
                    <td data-label="ชั่วโมง" className="px-4 py-3 text-right font-semibold tabular-nums">
                      {fmt.format(p.hours)} ชม.
                    </td>
                    <td data-label="ราคา" className="px-4 py-3 text-right font-semibold text-brand tabular-nums">
                      ฿{fmt.format(p.price)}
                    </td>
                    <td data-label="ตกชั่วโมงละ" className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                      ฿{fmt.format(p.pricePerHour)}
                    </td>
                    <td data-label="อายุ" className="px-4 py-3 text-muted-foreground">
                      {p.validDays > 0 ? `${p.validDays} วัน` : "ไม่หมดอายุ"}
                    </td>
                    <td data-label="คนถืออยู่" className="px-4 py-3 text-right tabular-nums">
                      {p.activeHolders > 0 ? fmt.format(p.activeHolders) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <RowActions>
                        <button type="button" onClick={() => setEditing(p)} className={rowAction()}>
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          aria-label={`เลิกขาย ${p.name}`}
                          onClick={() => {
                            // Said out loud: retiring is about the shelf, not
                            // about the hours people already paid for.
                            const held = p.activeHolders > 0
                              ? `\n\nลูกค้า ${p.activeHolders} คนที่ถืออยู่จะยังใช้ชั่วโมงได้ตามปกติ`
                              : "";
                            if (window.confirm(`เลิกขาย "${p.name}"?${held}`)) remove.mutate(p.id);
                          }}
                          className={rowAction("icon", "hover:bg-brand-danger/10 hover:text-brand-danger")}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </RowActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <PackageEditor
          pkg={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: KEY });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function PackageEditor({
  pkg,
  onClose,
  onSaved,
}: {
  pkg: OwnerVenuePackage | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: pkg?.name ?? "",
    hours: pkg?.hours ?? 10,
    price: pkg?.price ?? 2000,
    validDays: pkg?.validDays ?? 90,
  });

  const save = useMutation({
    mutationFn: () => (pkg ? ownerApi.updateVenuePackage(pkg.id, form) : ownerApi.createVenuePackage(form)),
    onSuccess: onSaved,
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const perHour = form.hours > 0 ? Math.round((form.price / form.hours) * 100) / 100 : 0;

  return (
    <Modal
      title={pkg ? `แก้ไข ${pkg.name}` : "เพิ่มแพ็กเกจ"}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            ปิด
          </Button>
          <Button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.name.trim() || form.hours <= 0 || form.price <= 0}
          >
            {save.isPending ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pk-name">ชื่อแพ็กเกจ</Label>
          <Input
            id="pk-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="เช่น แพ็ก 10 ชั่วโมง"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pk-hours">จำนวนชั่วโมง</Label>
          <Input
            id="pk-hours"
            type="number"
            min={1}
            value={form.hours}
            onChange={(e) => set("hours", Number(e.target.value))}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pk-price">ราคาขาย (บาท)</Label>
          <Input
            id="pk-price"
            type="number"
            min={1}
            value={form.price}
            onChange={(e) => set("price", Number(e.target.value))}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pk-valid">อายุการใช้งาน (วัน)</Label>
          <Input
            id="pk-valid"
            type="number"
            min={0}
            value={form.validDays}
            onChange={(e) => set("validDays", Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">ใส่ 0 = ไม่หมดอายุ</p>
        </div>

        <div className="sm:col-span-2 rounded-xl bg-app p-3 text-sm">
          ตกชั่วโมงละ <strong className="text-brand">฿{fmt.format(perHour)}</strong>
          <span className="block text-xs text-muted-foreground">
            ระบบจะคิด “ประหยัดกี่ %” ให้เอง โดยเทียบกับราคาคอร์ทที่ถูกที่สุดของสนาม
          </span>
        </div>

        {pkg && pkg.activeHolders > 0 && (
          <p className="sm:col-span-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
            มีลูกค้า {pkg.activeHolders} คนถือแพ็กเกจนี้อยู่ — แก้ราคาหรือชั่วโมงจะมีผลกับ<strong>คนซื้อใหม่เท่านั้น</strong>
            ของที่ขายไปแล้วไม่เปลี่ยน
          </p>
        )}

        {save.isError && (
          <p className="sm:col-span-2 text-sm text-brand-danger">{(save.error as Error).message}</p>
        )}
      </div>
    </Modal>
  );
}
