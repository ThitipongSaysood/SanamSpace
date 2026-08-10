"use client";
import type { LineBlock } from "@/lib/types";

/**
 * A faithful preview of what the backend LineFlexRenderer will send — the same
 * block vocabulary, drawn as a LINE bubble inside a phone frame, with
 * {{placeholders}} filled by sample values so the owner sees a realistic card
 * while editing. Keep this in sync with backend/app/Support/LineFlexRenderer.php.
 */

export const SAMPLE_VARS: Record<string, string> = {
  venueName: "สนามของคุณ",
  branchName: "สาขาหลัก",
  customerName: "คุณลูกค้า ตัวอย่าง",
  phone: "0812345678",
  courtName: "Court 1",
  bookingCode: "BKF-DEMO-01",
  date: "ส. 15 ส.ค. 2569",
  time: "09:00-10:00",
  duration: "1 ชม.",
  amount: "450",
  paymentMethod: "เครดิต",
  creditUsed: "450",
  creditBalance: "3,150",
  bookingUrl: "https://example.app",
};

/** The tokens shown in the palette, with a Thai label for each. */
export const PLACEHOLDERS: { token: string; label: string }[] = [
  { token: "{{venueName}}", label: "ชื่อสนาม" },
  { token: "{{branchName}}", label: "สาขา" },
  { token: "{{customerName}}", label: "ชื่อลูกค้า" },
  { token: "{{phone}}", label: "เบอร์โทร" },
  { token: "{{courtName}}", label: "คอร์ท" },
  { token: "{{bookingCode}}", label: "รหัสจอง" },
  { token: "{{date}}", label: "วันที่" },
  { token: "{{time}}", label: "เวลา" },
  { token: "{{duration}}", label: "ระยะเวลา" },
  { token: "{{amount}}", label: "ยอดรวม" },
  { token: "{{paymentMethod}}", label: "วิธีชำระ" },
  { token: "{{creditUsed}}", label: "ตัดเครดิต" },
  { token: "{{creditBalance}}", label: "เครดิตคงเหลือ" },
  { token: "{{bookingUrl}}", label: "ลิงก์การจอง" },
];

const SIZE_CLASS: Record<string, string> = {
  xs: "text-[10px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  xl: "text-lg",
  xxl: "text-xl",
};

function sub(s: string | undefined, vars: Record<string, string>): string {
  if (!s) return "";
  return s.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

function isHttp(u?: string) {
  return !!u && (u.startsWith("http://") || u.startsWith("https://"));
}

function alignClass(a?: string) {
  return a === "center" ? "text-center" : a === "end" ? "text-right" : "text-left";
}

function Block({ block, vars }: { block: LineBlock; vars: Record<string, string> }) {
  switch (block.type) {
    case "image": {
      const url = sub(block.url, vars);
      return isHttp(url) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full rounded-lg object-cover" style={{ aspectRatio: "20 / 13" }} />
      ) : (
        <div className="grid aspect-[20/13] w-full place-items-center rounded-lg bg-black/5 text-[10px] text-muted-foreground">รูปภาพ</div>
      );
    }
    case "logo": {
      const url = sub(block.url, vars);
      return (
        <div className="flex justify-center">
          {isHttp(url) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="size-12 rounded-full object-cover ring-1 ring-black/10" />
          ) : (
            <div className="grid size-12 place-items-center rounded-full bg-black/5 text-[9px] text-muted-foreground">โลโก้</div>
          )}
        </div>
      );
    }
    case "title":
      return (
        <div
          className={`font-bold leading-snug ${SIZE_CLASS[block.size ?? "lg"] ?? "text-base"} ${alignClass(block.align)}`}
          style={{ color: block.color }}
        >
          {sub(block.text, vars) || " "}
        </div>
      );
    case "text":
      return (
        <div
          className={`leading-snug ${SIZE_CLASS[block.size ?? "sm"] ?? "text-xs"} ${block.weight === "bold" ? "font-bold" : ""} ${alignClass(block.align)}`}
          style={{ color: block.color }}
        >
          {sub(block.text, vars) || " "}
        </div>
      );
    case "divider":
      return <hr className="border-black/10" />;
    case "infoRow":
      return (
        <div className="flex items-start justify-between gap-3 text-xs">
          <span className="shrink-0 text-muted-foreground">{sub(block.label, vars) || " "}</span>
          <span className="text-right font-semibold" style={{ color: block.color }}>
            {sub(block.value, vars) || " "}
          </span>
        </div>
      );
    case "button": {
      return <PreviewButton label={sub(block.label, vars)} url={sub(block.url, vars)} style={block.style} color={block.color} />;
    }
    case "buttonRow":
      return (
        <div className="flex gap-2">
          {(block.buttons ?? []).map((b, i) => (
            <div key={i} className="flex-1">
              <PreviewButton label={sub(b.label, vars)} url={sub(b.url, vars)} style={b.style} color={b.color} />
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}

function PreviewButton({ label, url, style, color }: { label: string; url: string; style?: string; color?: string }) {
  const primary = !style || style === "primary";
  const link = style === "link";
  return (
    <div
      className={`grid h-9 w-full place-items-center rounded-lg px-2 text-center text-xs font-semibold ${
        link ? "text-brand" : primary ? "text-white" : "text-foreground ring-1 ring-black/15"
      }`}
      style={primary && !link ? { background: color || "#1D4ED8" } : undefined}
      title={isHttp(url) ? url : "ยังไม่มีลิงก์ — ปุ่มนี้จะไม่ถูกส่ง"}
    >
      <span className="truncate">{label || "ปุ่ม"}</span>
    </div>
  );
}

export function LineFlexPreview({
  blocks,
  vars = SAMPLE_VARS,
}: {
  blocks: LineBlock[];
  vars?: Record<string, string>;
}) {
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-[26px] bg-[#7C98B3] p-3 shadow-inner">
      <div className="mb-2 text-center text-[11px] font-medium text-white/90">LINE</div>
      <div className="overflow-hidden rounded-2xl bg-white shadow-md">
        <div className="space-y-2.5 p-4">
          {blocks.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">ยังไม่มีบล็อก — เพิ่มบล็อกเพื่อเริ่มออกแบบ</p>
          ) : (
            blocks.map((b, i) => <Block key={i} block={b} vars={vars} />)
          )}
        </div>
      </div>
    </div>
  );
}
