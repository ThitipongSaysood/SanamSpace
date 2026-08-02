"use client";
import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BillingDocument } from "@/lib/types";

const money = (n: number) =>
  `฿${n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * A billing document — ใบแจ้งหนี้ before payment, ใบเสร็จรับเงิน after, and
 * ใบกำกับภาษี on top of either when the platform charges VAT.
 *
 * Rendered from the server's payload rather than assembled per portal, so the
 * venue and the platform always look at the identical document. Which kind it
 * is, and what it is numbered, is the server's call — not the screen's.
 */
export function BillingDocument({ doc }: { doc: BillingDocument }) {
  const paid = doc.kind === "receipt";

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-bold text-brand">{doc.seller.name}</div>
          <div className="text-xs text-muted-foreground">
            {doc.title} / {doc.titleEn}
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold">{doc.titleEn}</div>
          <div className="font-mono text-xs text-muted-foreground">{doc.number}</div>
          {doc.reference && (
            <div className="mt-0.5 text-[11px] text-muted-foreground">อ้างอิง {doc.reference}</div>
          )}
        </div>
      </div>

      {paid && (
        <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          ชำระแล้ว{doc.paidDate ? ` เมื่อ ${doc.paidDate}` : ""}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Party label="ผู้ให้บริการ" name={doc.seller.name} taxId={doc.seller.taxId} address={doc.seller.address} />
        <Party
          label={paid ? "ได้รับเงินจาก" : "เรียกเก็บจาก"}
          name={doc.buyer.name}
          taxId={doc.buyer.taxId}
          address={doc.buyer.address}
          branch={doc.buyer.branch}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={paid ? "วันที่ออกใบเสร็จ" : "วันที่ออก"} value={doc.issueDate} />
        <Field label={paid ? "อ้างอิงใบแจ้งหนี้" : "ครบกำหนด"} value={paid ? doc.reference : doc.dueDate} />
      </div>

      <table className="w-full">
        <thead className="border-b border-black/10 text-left text-xs text-muted-foreground">
          <tr>
            <th className="py-2 font-medium">รายการ</th>
            <th className="py-2 text-right font-medium">จำนวน</th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((line, i) => (
            <tr key={i} className="border-b border-black/5">
              <td className="py-2">{line.description}</td>
              <td className="py-2 text-right tabular-nums">{money(line.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Totals doc={doc} />
    </div>
  );
}

function Totals({ doc }: { doc: BillingDocument }) {
  return (
    <div className="ml-auto max-w-xs space-y-1">
      {doc.vatRate > 0 && (
        <>
          <Row label="มูลค่าก่อนภาษี" value={money(doc.subtotal)} />
          <Row label={`ภาษีมูลค่าเพิ่ม ${doc.vatRate}%`} value={money(doc.vatAmount)} />
        </>
      )}
      <div className="flex justify-between border-t-2 border-foreground pt-2 text-base font-bold">
        <span>ยอดรวม</span>
        <span className="text-brand tabular-nums">{money(doc.total)}</span>
      </div>
      {doc.vatInclusive && (
        <p className="text-[11px] text-muted-foreground">* ราคารวมภาษีมูลค่าเพิ่มแล้ว</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}

function Party({
  label,
  name,
  taxId,
  address,
  branch,
}: {
  label: string;
  name: string;
  taxId?: string | null;
  address?: string | null;
  branch?: string | null;
}) {
  return (
    <div className="rounded-xl bg-app/60 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{name}</div>
      {taxId && <div className="mt-0.5 text-xs text-muted-foreground">เลขประจำตัวผู้เสียภาษี {taxId}</div>}
      {branch && <div className="text-xs text-muted-foreground">{branch}</div>}
      {address && <div className="mt-0.5 whitespace-pre-line text-xs text-muted-foreground">{address}</div>}
    </div>
  );
}

/**
 * Opens the server-rendered PDF in a new tab.
 *
 * Server-side rather than the browser's print dialog: this copy gets filed and
 * forwarded, so it has to look the same for everyone — and it carries an
 * embedded Thai font instead of relying on whatever the reader has installed.
 */
export function OpenPdfButton({
  onFetch,
  kind,
}: {
  onFetch: () => Promise<string>;
  kind: "invoice" | "receipt";
}) {
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    try {
      const url = await onFetch();
      window.open(url, "_blank", "noopener");
      // Freed once the new tab has had time to take the blob.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={open} disabled={busy}>
      <FileDown className="size-4" />
      {busy ? "กำลังสร้าง..." : `เปิด PDF ${kind === "receipt" ? "ใบเสร็จ" : "ใบแจ้งหนี้"}`}
    </Button>
  );
}
