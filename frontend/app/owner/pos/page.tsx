"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Banknote, Minus, Package, Plus, QrCode, Trash2 } from "lucide-react";
import type { OwnerProduct, OwnerSale } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

const fmt = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

type Cart = Record<string, number>;

/**
 * The counter's till.
 *
 * Built for one hand and a customer waiting: tap to add, the total is always on
 * screen, and the two payment buttons are the largest things on the page. Stock
 * is checked server-side inside the sale's transaction — this screen warns, but
 * it is never the thing standing between the shelf and the truth.
 */
export default function OwnerPosPage() {
  const qc = useQueryClient();
  const [cart, setCart] = useState<Cart>({});
  const [done, setDone] = useState<OwnerSale | null>(null);
  const [payingQr, setPayingQr] = useState<OwnerSale | null>(null);

  const productsQ = useQuery({ queryKey: ["owner", "products", "sellable"], queryFn: () => ownerApi.getProducts(true) });
  const summaryQ = useQuery({ queryKey: ["owner", "sales", "summary"], queryFn: () => ownerApi.getSalesSummary() });

  const products = useMemo(() => productsQ.data ?? [], [productsQ.data]);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => ({ product: byId.get(id), qty }))
        .filter((l): l is { product: OwnerProduct; qty: number } => Boolean(l.product)),
    [cart, byId],
  );

  const total = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);

  const sell = useMutation({
    mutationFn: (method: "cash" | "transfer") =>
      ownerApi.createSale(
        Object.entries(cart).map(([productId, quantity]) => ({ productId, quantity })),
        method,
      ),
    onSuccess: (sale, method) => {
      setCart({});
      qc.invalidateQueries({ queryKey: ["owner", "products"] });
      qc.invalidateQueries({ queryKey: ["owner", "sales"] });
      // Transfer needs the customer to scan something before they leave.
      if (method === "transfer") setPayingQr(sale);
      else setDone(sale);
    },
  });

  function add(p: OwnerProduct) {
    if (p.stockQty <= 0) return;
    setCart((c) => ({ ...c, [p.id]: Math.min((c[p.id] ?? 0) + 1, p.stockQty) }));
  }

  function setQty(id: string, qty: number) {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  if (productsQ.isLoading) return <Loading rows={4} />;
  if (productsQ.isError) return <ErrorState onRetry={() => productsQ.refetch()} />;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ขายหน้าร้าน</h1>
          <p className="text-sm text-muted-foreground">แตะสินค้าเพื่อเพิ่มลงตะกร้า แล้วเลือกวิธีรับเงิน</p>
        </div>
        <div className="flex items-center gap-4">
          {summaryQ.data && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">ยอดขายวันนี้</div>
              <div className="text-xl font-bold text-brand">฿{fmt.format(summaryQ.data.total)}</div>
              <div className="text-xs text-muted-foreground">
                {summaryQ.data.saleCount} รายการ · เงินสด ฿{fmt.format(summaryQ.data.cashTotal)} · โอน ฿
                {fmt.format(summaryQ.data.transferTotal)}
              </div>
            </div>
          )}
          <Link
            href="/owner/products"
            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium hover:bg-app"
          >
            <Package className="size-4" /> จัดการสินค้า
          </Link>
        </div>
      </header>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 bg-white p-10 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand">
            <Package className="size-6" />
          </div>
          <p className="mt-3 font-semibold">ยังไม่มีสินค้า</p>
          <p className="mt-0.5 text-sm text-muted-foreground">เพิ่มน้ำดื่ม ขนม หรือลูกขนไก่ ก่อนเริ่มขาย</p>
          <Link
            href="/owner/products"
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground"
          >
            เพิ่มสินค้า
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          {/* Products — big tap targets, because this is used standing up. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => add(p)}
                disabled={p.stockState === "out"}
                className="flex flex-col rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-black/5 transition active:scale-[0.98] disabled:opacity-45"
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="mb-2 aspect-square w-full rounded-xl object-cover" />
                ) : (
                  <span className="mb-2 grid aspect-square w-full place-items-center rounded-xl bg-app text-muted-foreground">
                    <Package className="size-7" />
                  </span>
                )}
                <span className="line-clamp-2 text-sm font-semibold">{p.name}</span>
                <span className="mt-0.5 font-bold text-brand">฿{fmt.format(p.price)}</span>
                <StockNote product={p} />
                {cart[p.id] > 0 && (
                  <span className="mt-1 inline-flex w-fit items-center rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-brand-foreground">
                    ในตะกร้า {cart[p.id]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Cart — sticky, so the total never scrolls away mid-sale. */}
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
              <header className="flex items-center justify-between border-b border-black/5 px-4 py-3">
                <h2 className="font-semibold">ตะกร้า</h2>
                {lines.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart({})}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-brand-danger"
                  >
                    <Trash2 className="size-3.5" /> ล้าง
                  </button>
                )}
              </header>

              {lines.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">ยังไม่ได้เลือกสินค้า</p>
              ) : (
                <ul className="divide-y divide-black/5">
                  {lines.map(({ product, qty }) => (
                    <li key={product.id} className="flex items-center gap-2 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{product.name}</div>
                        <div className="text-xs text-muted-foreground">฿{fmt.format(product.price)} / ชิ้น</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`ลด ${product.name}`}
                          onClick={() => setQty(product.id, qty - 1)}
                          className="grid size-8 place-items-center rounded-lg bg-app text-muted-foreground"
                        >
                          <Minus className="size-4" />
                        </button>
                        <span className="w-7 text-center text-sm font-semibold tabular-nums">{qty}</span>
                        <button
                          type="button"
                          aria-label={`เพิ่ม ${product.name}`}
                          onClick={() => setQty(product.id, Math.min(qty + 1, product.stockQty))}
                          disabled={qty >= product.stockQty}
                          className="grid size-8 place-items-center rounded-lg bg-app text-muted-foreground disabled:opacity-40"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                      <span className="w-16 shrink-0 text-right text-sm font-semibold">
                        ฿{fmt.format(product.price * qty)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-black/5 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">รวมทั้งหมด</span>
                  <span className="text-2xl font-bold text-brand">฿{fmt.format(total)}</span>
                </div>

                {sell.isError && (
                  <p className="mt-2 rounded-lg bg-brand-danger/10 p-2 text-xs text-brand-danger">
                    {(sell.error as Error).message}
                  </p>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12"
                    disabled={lines.length === 0 || sell.isPending}
                    onClick={() => sell.mutate("cash")}
                  >
                    <Banknote className="size-4" /> เงินสด
                  </Button>
                  <Button
                    type="button"
                    className="h-12"
                    disabled={lines.length === 0 || sell.isPending}
                    onClick={() => sell.mutate("transfer")}
                  >
                    <QrCode className="size-4" /> โอน / QR
                  </Button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {done && <SaleDone sale={done} onClose={() => setDone(null)} />}
      {payingQr && (
        <PromptPayDialog
          sale={payingQr}
          onClose={() => {
            setDone(payingQr);
            setPayingQr(null);
          }}
        />
      )}
    </div>
  );
}

/** Warns, never blocks — "nearly out" is information, not a refusal. */
function StockNote({ product }: { product: OwnerProduct }) {
  if (product.stockState === "out") {
    return <span className="mt-0.5 text-xs font-semibold text-brand-danger">หมด</span>;
  }
  if (product.stockState === "low") {
    return <span className="mt-0.5 text-xs font-semibold text-amber-600">ใกล้หมด · เหลือ {product.stockQty}</span>;
  }
  return <span className="mt-0.5 text-xs text-muted-foreground">เหลือ {product.stockQty}</span>;
}

/** The QR the customer scans. Drawn from the venue's own PromptPay id. */
function PromptPayDialog({ sale, onClose }: { sale: OwnerSale; onClose: () => void }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["owner", "sale-promptpay", sale.id],
    queryFn: () => ownerApi.getSalePromptPay(sale.id),
    retry: false,
  });

  const [src, setSrc] = useState<string | null>(null);
  const payload = data?.payload;

  useEffect(() => {
    if (!payload) return;
    let alive = true;
    QRCode.toDataURL(payload, { margin: 1, width: 520, errorCorrectionLevel: "M" })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [payload]);

  return (
    <Modal
      title={`รับเงิน ฿${fmt.format(sale.total)}`}
      onClose={onClose}
      footer={
        <Button type="button" onClick={onClose}>
          รับเงินแล้ว
        </Button>
      }
    >
      <div className="space-y-3 text-center">
        {isLoading && <div className="mx-auto size-60 animate-pulse rounded-xl bg-app" />}

        {isError && (
          <p className="rounded-xl bg-brand-accent/15 p-4 text-sm">
            {(error as Error).message}
            <span className="mt-1 block text-xs text-muted-foreground">
              ขายไปแล้ว (ใบเสร็จ {sale.code}) — รับเงินด้วยวิธีอื่นได้เลย
            </span>
          </p>
        )}

        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="PromptPay QR" width={240} height={240} className="mx-auto rounded-xl" />
        )}

        {data?.payTo && <p className="text-sm font-medium">{data.payTo}</p>}
        <p className="font-mono text-xs text-muted-foreground">{sale.code}</p>
      </div>
    </Modal>
  );
}

function SaleDone({ sale, onClose }: { sale: OwnerSale; onClose: () => void }) {
  return (
    <Modal
      title="ขายเรียบร้อย"
      onClose={onClose}
      footer={
        <Button type="button" onClick={onClose}>
          ขายรายการต่อไป
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-sm text-muted-foreground">{sale.code}</span>
          <span className="text-2xl font-bold text-brand">฿{fmt.format(sale.total)}</span>
        </div>
        <ul className="divide-y divide-black/5 rounded-xl bg-app p-1">
          {sale.items.map((i) => (
            <li key={i.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {i.name} × {i.quantity}
              </span>
              <span className="font-medium">฿{fmt.format(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          รับเงิน: {sale.paymentMethod === "cash" ? "เงินสด" : "โอน / QR"}
        </p>
      </div>
    </Modal>
  );
}
