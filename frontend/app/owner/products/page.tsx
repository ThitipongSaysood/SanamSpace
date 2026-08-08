"use client";
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageOff, Package, Plus, ShoppingCart, Trash2 } from "lucide-react";
import type { OwnerProduct, ProductInput } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { RowActions, rowAction } from "@/components/ui/row-action";

const KEY = ["owner", "products"];
const fmt = new Intl.NumberFormat("th-TH");

/** The catalogue behind the till: what is on sale, and how much is left. */
export default function OwnerProductsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...KEY, "all"],
    queryFn: () => ownerApi.getProducts(),
  });

  const [editing, setEditing] = useState<OwnerProduct | "new" | null>(null);
  const [restocking, setRestocking] = useState<OwnerProduct | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: KEY });
  const products = data ?? [];
  const lowOrOut = products.filter((p) => p.isActive && p.stockState !== "ok");

  if (isLoading) return <Loading rows={4} />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">สินค้า</h1>
          <p className="text-sm text-muted-foreground">ของที่ขายหน้าเคาน์เตอร์ · ราคาและจำนวนคงเหลือ</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/owner/pos"
            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium hover:bg-app"
          >
            <ShoppingCart className="size-4" /> ไปหน้าขาย
          </Link>
          <Button type="button" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> เพิ่มสินค้า
          </Button>
        </div>
      </header>

      {/* The thing an owner opens this page to find out. */}
      {lowOrOut.length > 0 && (
        <p className="rounded-2xl bg-brand-accent/15 p-4 text-sm">
          <strong>ต้องเติมของ {lowOrOut.length} รายการ</strong> —{" "}
          {lowOrOut.map((p) => `${p.name} (${p.stockQty})`).join(" · ")}
        </p>
      )}

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 bg-white p-10 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand">
            <Package className="size-6" />
          </div>
          <p className="mt-3 font-semibold">ยังไม่มีสินค้า</p>
          <p className="mt-0.5 text-sm text-muted-foreground">เช่น น้ำเปล่า เครื่องดื่มเกลือแร่ ลูกขนไก่</p>
          <Button type="button" className="mt-4" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> เพิ่มสินค้าแรก
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[760px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="w-20 px-4 py-3">รูป</th>
                  <th className="px-4 py-3">สินค้า</th>
                  <th className="px-4 py-3 text-right">ราคา</th>
                  <th className="px-4 py-3">คงเหลือ</th>
                  <th className="px-4 py-3">สถานะ</th>
                  <th className="w-64 px-4 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {products.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    onEdit={() => setEditing(p)}
                    onRestock={() => setRestocking(p)}
                    onChanged={refresh}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <ProductEditor
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
      {restocking && (
        <RestockDialog product={restocking} onClose={() => setRestocking(null)} onSaved={refresh} />
      )}
    </div>
  );
}

function ProductRow({
  product,
  onEdit,
  onRestock,
  onChanged,
}: {
  product: OwnerProduct;
  onEdit: () => void;
  onRestock: () => void;
  onChanged: () => void;
}) {
  const remove = useMutation({
    mutationFn: () => ownerApi.deleteProduct(product.id),
    onSuccess: onChanged,
  });

  const toggle = useMutation({
    mutationFn: () => ownerApi.updateProduct(product.id, { isActive: !product.isActive }),
    onSuccess: onChanged,
  });

  return (
    <tr className={`hover:bg-app/60 ${product.isActive ? "" : "opacity-60"}`}>
      <td data-label="รูป" className="px-4 py-3">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt="" className="size-12 rounded-lg object-cover ring-1 ring-black/10" />
        ) : (
          <span className="grid size-12 place-items-center rounded-lg bg-app text-muted-foreground">
            <ImageOff className="size-4" />
          </span>
        )}
      </td>
      <td data-label="สินค้า" className="px-4 py-3">
        <div className="font-medium">{product.name}</div>
        {product.category && <div className="text-xs text-muted-foreground">{product.category}</div>}
      </td>
      <td data-label="ราคา" className="px-4 py-3 text-right font-semibold text-brand">
        ฿{fmt.format(product.price)}
      </td>
      <td data-label="คงเหลือ" className="px-4 py-3 tabular-nums">{fmt.format(product.stockQty)}</td>
      <td data-label="สถานะ" className="px-4 py-3">
        <StockPill product={product} />
      </td>
      <td data-actions className="px-4 py-3">
        <RowActions>
          <button type="button" onClick={onRestock} className={rowAction()}>
            เติมของ
          </button>
          <button type="button" onClick={onEdit} className={rowAction()}>
            แก้ไข
          </button>
          <button
            type="button"
            onClick={() => toggle.mutate()}
            disabled={toggle.isPending}
            className={rowAction(product.isActive ? "on" : "off")}
          >
            {product.isActive ? "ขายอยู่" : "ปิดขาย"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`ลบ ${product.name}? ถ้าแค่หยุดขายชั่วคราว ให้กด “ขายอยู่” เพื่อปิดแทน`)) {
                remove.mutate();
              }
            }}
            disabled={remove.isPending}
            aria-label={`ลบ ${product.name}`}
            className={rowAction("icon", "hover:bg-brand-danger/10 hover:text-brand-danger")}
          >
            <Trash2 className="size-4" />
          </button>
        </RowActions>
      </td>
    </tr>
  );
}

function StockPill({ product }: { product: OwnerProduct }) {
  if (product.stockState === "out") {
    return <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700">หมด</span>;
  }
  if (product.stockState === "low") {
    return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">ใกล้หมด</span>;
  }
  return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">พอขาย</span>;
}

/** Two different acts, so two different fields: a delivery arrived, or a count was wrong. */
function RestockDialog({
  product,
  onClose,
  onSaved,
}: {
  product: OwnerProduct;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [delta, setDelta] = useState("");
  const [set, setSet] = useState("");

  const save = useMutation({
    mutationFn: () =>
      ownerApi.adjustStock(
        product.id,
        set.trim() !== "" ? { set: Number(set) } : { delta: Number(delta) },
      ),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  const valid = set.trim() !== "" ? Number(set) >= 0 : Number(delta) !== 0 && !Number.isNaN(Number(delta));

  return (
    <Modal
      title={`เติมของ — ${product.name}`}
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
          <Button type="button" onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            {save.isPending ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-app p-3 text-sm">
          ตอนนี้เหลือ <strong>{fmt.format(product.stockQty)}</strong> ชิ้น
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="delta">ของเข้า / ของออก</Label>
          <Input
            id="delta"
            type="number"
            value={delta}
            onChange={(e) => {
              setDelta(e.target.value);
              setSet("");
            }}
            placeholder="เช่น 24 (ของเข้า) หรือ -2 (ของเสีย)"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="set">หรือนับสต็อกใหม่</Label>
          <Input
            id="set"
            type="number"
            min={0}
            value={set}
            onChange={(e) => {
              setSet(e.target.value);
              setDelta("");
            }}
            placeholder="ใส่จำนวนจริงที่นับได้"
          />
          <p className="text-xs text-muted-foreground">ใช้เมื่อจำนวนในระบบไม่ตรงกับของบนชั้น</p>
        </div>
      </div>
    </Modal>
  );
}

function ProductEditor({
  product,
  onClose,
  onSaved,
}: {
  product: OwnerProduct | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ProductInput>({
    name: product?.name ?? "",
    category: product?.category ?? "",
    price: product?.price ?? 0,
    stockQty: product?.stockQty ?? 0,
    lowStockThreshold: product?.lowStockThreshold ?? 5,
    imageUrl: product?.imageUrl ?? null,
    isActive: product?.isActive ?? true,
  });

  const [uploading, setUploading] = useState(false);
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      setForm((f) => ({ ...f, imageUrl: null }));
      const url = await ownerApi.uploadImage(file);
      setForm((f) => ({ ...f, imageUrl: url }));
    } finally {
      setUploading(false);
    }
  }

  const save = useMutation({
    mutationFn: () => {
      // Stock is only set on create; after that it moves through เติมของ, so an
      // edit cannot silently rewrite the count on the shelf.
      const { stockQty, ...rest } = form;
      return product
        ? ownerApi.updateProduct(product.id, rest)
        : ownerApi.createProduct({ ...rest, stockQty });
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  const valid = (form.name ?? "").trim().length > 0 && Number(form.price) >= 0;

  return (
    <Modal
      title={product ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}
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
          <Label htmlFor="p-name">ชื่อสินค้า</Label>
          <Input
            id="p-name"
            value={form.name ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="เช่น น้ำเปล่า 600ml"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="p-price">ราคา (บาท)</Label>
            <Input
              id="p-price"
              type="number"
              min={0}
              value={form.price ?? 0}
              onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-category">หมวด (ไม่บังคับ)</Label>
            <Input
              id="p-category"
              value={form.category ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="เครื่องดื่ม / ขนม / อุปกรณ์"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {!product && (
            <div className="space-y-1.5">
              <Label htmlFor="p-stock">จำนวนเริ่มต้น</Label>
              <Input
                id="p-stock"
                type="number"
                min={0}
                value={form.stockQty ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, stockQty: Number(e.target.value) }))}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="p-low">เตือนเมื่อเหลือน้อยกว่า</Label>
            <Input
              id="p-low"
              type="number"
              min={0}
              value={form.lowStockThreshold ?? 5}
              onChange={(e) => setForm((f) => ({ ...f, lowStockThreshold: Number(e.target.value) }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>รูปสินค้า (ไม่บังคับ)</Label>
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
            {form.imageUrl && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, imageUrl: null }))}
                className="text-xs text-muted-foreground hover:text-brand-danger"
              >
                ลบรูป
              </button>
            )}
          </div>
        </div>

        {product && (
          <p className="rounded-xl bg-app p-3 text-xs text-muted-foreground">
            จำนวนคงเหลือแก้ที่ปุ่ม <strong>เติมของ</strong> — แยกกันไว้เพื่อให้การแก้ราคาไม่เผลอเปลี่ยนสต็อก
          </p>
        )}
      </div>
    </Modal>
  );
}
