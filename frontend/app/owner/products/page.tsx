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
import { useMessages } from "@/lib/i18n/context";
import { fmt as interp } from "@/lib/i18n/format";

const KEY = ["owner", "products"];
const fmt = new Intl.NumberFormat("th-TH");

/** The catalogue behind the till: what is on sale, and how much is left. */
export default function OwnerProductsPage() {
  const t = useMessages("owner").products;
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
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/owner/pos"
            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium hover:bg-app"
          >
            <ShoppingCart className="size-4" /> {t.toPos}
          </Link>
          <Button type="button" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> {t.addProduct}
          </Button>
        </div>
      </header>

      {/* The thing an owner opens this page to find out. */}
      {lowOrOut.length > 0 && (
        <p className="rounded-2xl bg-brand-accent/15 p-4 text-sm">
          <strong>{interp(t.needRestock, { n: lowOrOut.length })}</strong> —{" "}
          {lowOrOut.map((p) => `${p.name} (${p.stockQty})`).join(" · ")}
        </p>
      )}

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 bg-white p-10 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand">
            <Package className="size-6" />
          </div>
          <p className="mt-3 font-semibold">{t.noProducts}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.noProductsHint}</p>
          <Button type="button" className="mt-4" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> {t.addFirst}
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[760px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="w-20 px-4 py-3">{t.colImage}</th>
                  <th className="px-4 py-3">{t.colProduct}</th>
                  <th className="px-4 py-3 text-right">{t.colPrice}</th>
                  <th className="px-4 py-3">{t.colStock}</th>
                  <th className="px-4 py-3">{t.colStatus}</th>
                  <th className="w-64 px-4 py-3 text-right">{t.colActions}</th>
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
  const t = useMessages("owner").products;
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
      <td data-label={t.colImage} className="px-4 py-3">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt="" className="size-12 rounded-lg object-cover ring-1 ring-black/10" />
        ) : (
          <span className="grid size-12 place-items-center rounded-lg bg-app text-muted-foreground">
            <ImageOff className="size-4" />
          </span>
        )}
      </td>
      <td data-label={t.colProduct} className="px-4 py-3">
        <div className="font-medium">{product.name}</div>
        {product.category && <div className="text-xs text-muted-foreground">{product.category}</div>}
      </td>
      <td data-label={t.colPrice} className="px-4 py-3 text-right font-semibold text-brand">
        ฿{fmt.format(product.price)}
      </td>
      <td data-label={t.colStock} className="px-4 py-3 tabular-nums">{fmt.format(product.stockQty)}</td>
      <td data-label={t.colStatus} className="px-4 py-3">
        <StockPill product={product} />
      </td>
      <td data-actions className="px-4 py-3">
        <RowActions>
          <button type="button" onClick={onRestock} className={rowAction()}>
            {t.restock}
          </button>
          <button type="button" onClick={onEdit} className={rowAction()}>
            {t.edit}
          </button>
          <button
            type="button"
            onClick={() => toggle.mutate()}
            disabled={toggle.isPending}
            className={rowAction(product.isActive ? "on" : "off")}
          >
            {product.isActive ? t.selling : t.offSale}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(interp(t.deleteConfirm, { name: product.name }))) {
                remove.mutate();
              }
            }}
            disabled={remove.isPending}
            aria-label={interp(t.deleteAria, { name: product.name })}
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
  const t = useMessages("owner").products;
  if (product.stockState === "out") {
    return <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700">{t.stockOut}</span>;
  }
  if (product.stockState === "low") {
    return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">{t.stockLow}</span>;
  }
  return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">{t.stockOk}</span>;
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
  const t = useMessages("owner").products;
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
      title={interp(t.restockTitle, { name: product.name })}
      onClose={onClose}
      footer={
        <>
          {save.isError && (
            <span className="mr-auto self-center text-sm text-brand-danger">
              {(save.error as Error).message}
            </span>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            {save.isPending ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-app p-3 text-sm">
          {t.nowLeftPre}<strong>{fmt.format(product.stockQty)}</strong>{t.nowLeftPost}
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="delta">{t.deltaLabel}</Label>
          <Input
            id="delta"
            type="number"
            value={delta}
            onChange={(e) => {
              setDelta(e.target.value);
              setSet("");
            }}
            placeholder={t.deltaPlaceholder}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="set">{t.setLabel}</Label>
          <Input
            id="set"
            type="number"
            min={0}
            value={set}
            onChange={(e) => {
              setSet(e.target.value);
              setDelta("");
            }}
            placeholder={t.setPlaceholder}
          />
          <p className="text-xs text-muted-foreground">{t.setHint}</p>
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
  const t = useMessages("owner").products;
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
      title={product ? t.editTitle : t.addProduct}
      onClose={onClose}
      footer={
        <>
          {save.isError && (
            <span className="mr-auto self-center text-sm text-brand-danger">
              {(save.error as Error).message}
            </span>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" onClick={() => save.mutate()} disabled={!valid || save.isPending || uploading}>
            {save.isPending ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="p-name">{t.nameLabel}</Label>
          <Input
            id="p-name"
            value={form.name ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t.namePlaceholder}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="p-price">{t.priceLabel}</Label>
            <Input
              id="p-price"
              type="number"
              min={0}
              value={form.price ?? 0}
              onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-category">{t.categoryLabel}</Label>
            <Input
              id="p-category"
              value={form.category ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder={t.categoryPlaceholder}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {!product && (
            <div className="space-y-1.5">
              <Label htmlFor="p-stock">{t.initialQty}</Label>
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
            <Label htmlFor="p-low">{t.lowThreshold}</Label>
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
          <Label>{t.imageLabel}</Label>
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
              {uploading ? t.uploading : form.imageUrl ? t.changeImage : t.uploadImage}
              <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={uploading} />
            </label>
            {form.imageUrl && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, imageUrl: null }))}
                className="text-xs text-muted-foreground hover:text-brand-danger"
              >
                {t.removeImage}
              </button>
            )}
          </div>
        </div>

        {product && (
          <p className="rounded-xl bg-app p-3 text-xs text-muted-foreground">
            {t.stockNotePre}<strong>{t.restock}</strong>{t.stockNotePost}
          </p>
        )}
      </div>
    </Modal>
  );
}
