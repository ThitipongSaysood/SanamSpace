"use client";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Image as ImageIcon,
  Minus,
  MousePointerClick,
  Plus,
  Rows3,
  Send,
  Trash2,
  Type,
} from "lucide-react";
import type { LineBlock, LineBlockType, LineButton, LineTemplateEvent, OwnerCustomer } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { toast, toastSave } from "@/lib/toast";
import { Loading, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LineFlexPreview, PLACEHOLDERS } from "@/components/line-flex-preview";

const EVENTS: { key: LineTemplateEvent; label: string; hint: string }[] = [
  { key: "booking_confirmed", label: "จองสำเร็จ", hint: "ส่งเมื่อการจองได้รับการยืนยัน (จ่ายครบ)" },
  { key: "payment_received", label: "รับชำระเงิน", hint: "ส่งเมื่อได้รับเงิน — ปิดไว้โดยค่าเริ่มต้น" },
  { key: "booking_cancelled", label: "ยกเลิกการจอง", hint: "ส่งเมื่อการจองถูกยกเลิก/หมดเวลา" },
];

const BLOCK_META: Record<LineBlockType, { label: string; icon: typeof Type }> = {
  image: { label: "รูปภาพ", icon: ImageIcon },
  logo: { label: "โลโก้", icon: ImageIcon },
  title: { label: "หัวข้อ", icon: Type },
  text: { label: "ข้อความ", icon: Type },
  divider: { label: "เส้นคั่น", icon: Minus },
  infoRow: { label: "แถวข้อมูล", icon: Rows3 },
  button: { label: "ปุ่ม", icon: MousePointerClick },
  buttonRow: { label: "แถวปุ่ม", icon: MousePointerClick },
};

const ADD_ORDER: LineBlockType[] = ["title", "text", "infoRow", "divider", "image", "logo", "button", "buttonRow"];

function blankBlock(type: LineBlockType): LineBlock {
  switch (type) {
    case "image":
      return { type, url: "" };
    case "logo":
      return { type, url: "" };
    case "title":
      return { type, text: "{{venueName}}", size: "xl" };
    case "text":
      return { type, text: "ขอบคุณที่ใช้บริการค่ะ", size: "sm", align: "center", color: "#8A8A8A" };
    case "divider":
      return { type };
    case "infoRow":
      return { type, label: "ป้ายกำกับ", value: "{{customerName}}" };
    case "button":
      return { type, label: "ปุ่ม", url: "{{bookingUrl}}", style: "primary", color: "#1D4ED8" };
    case "buttonRow":
      return { type, buttons: [{ label: "ข้อมูลการจอง", url: "{{bookingUrl}}", style: "primary", color: "#1D4ED8" }] };
  }
}

function summarise(b: LineBlock): string {
  switch (b.type) {
    case "title":
    case "text":
      return b.text ?? "";
    case "infoRow":
      return `${b.label ?? ""} · ${b.value ?? ""}`;
    case "button":
      return b.label ?? "";
    case "buttonRow":
      return (b.buttons ?? []).map((x) => x.label).join(" · ");
    case "image":
    case "logo":
      return b.url || "ยังไม่ได้ตั้งรูป";
    default:
      return "";
  }
}

export default function LineTemplatesPage() {
  const qc = useQueryClient();
  const templatesQ = useQuery({ queryKey: ["owner", "line-templates"], queryFn: ownerApi.getLineTemplates });

  const [event, setEvent] = useState<LineTemplateEvent>("booking_confirmed");
  const [draft, setDraft] = useState<{ enabled: boolean; blocks: LineBlock[] }>({ enabled: true, blocks: [] });
  const [expanded, setExpanded] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // Drag-to-reorder state, lifted here so every row can show the dragged item
  // dimmed and the insertion line where it will land.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropLine, setDropLine] = useState<{ index: number; pos: "above" | "below" } | null>(null);

  const current = templatesQ.data?.find((t) => t.event === event);

  // Re-seed the editable draft when the event changes or the server data
  // refreshes (e.g. after a save) — render-time, not in an effect, so the form
  // never paints a stale frame. Discards unsaved edits when switching events,
  // which is the expected "each event is its own card" behaviour.
  const stamp = current ? `${event}@${templatesQ.dataUpdatedAt}` : null;
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (stamp && seededFor !== stamp) {
    setSeededFor(stamp);
    setDraft({ enabled: current!.enabled, blocks: structuredClone(current!.blocks) });
    setExpanded(null);
  }

  const dirty = useMemo(() => {
    if (!current) return false;
    return JSON.stringify(draft) !== JSON.stringify({ enabled: current.enabled, blocks: current.blocks });
  }, [draft, current]);

  const save = useMutation({
    mutationFn: () => toastSave(ownerApi.saveLineTemplate(event, draft), { success: "บันทึกเทมเพลตแล้ว" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["owner", "line-templates"] }),
  });

  // --- block ops ---
  const setBlocks = (blocks: LineBlock[]) => setDraft((d) => ({ ...d, blocks }));
  const update = (i: number, patch: Partial<LineBlock>) =>
    setBlocks(draft.blocks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const remove = (i: number) => {
    setBlocks(draft.blocks.filter((_, idx) => idx !== i));
    setExpanded(null);
  };
  const duplicate = (i: number) => {
    const copy = structuredClone(draft.blocks[i]);
    setBlocks([...draft.blocks.slice(0, i + 1), copy, ...draft.blocks.slice(i + 1)]);
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= draft.blocks.length) return;
    const next = [...draft.blocks];
    const [b] = next.splice(from, 1);
    next.splice(to, 0, b);
    setBlocks(next);
    setExpanded(to);
  };
  // Drop the dragged block at an insertion slot (0..len, i.e. "before row N").
  const reorderTo = (from: number, insertIndex: number) => {
    const next = [...draft.blocks];
    const [b] = next.splice(from, 1);
    // Removing an earlier item shifts every later slot left by one.
    const idx = from < insertIndex ? insertIndex - 1 : insertIndex;
    next.splice(idx, 0, b);
    setBlocks(next);
    setExpanded(idx);
  };
  const endDrag = () => {
    setDragIndex(null);
    setDropLine(null);
  };
  const add = (type: LineBlockType) => {
    setBlocks([...draft.blocks, blankBlock(type)]);
    setExpanded(draft.blocks.length);
  };

  function copyToken(token: string) {
    navigator.clipboard?.writeText(token).catch(() => {});
    setCopied(token);
    window.setTimeout(() => setCopied((c) => (c === token ? null : c)), 1200);
  }

  if (templatesQ.isLoading) return <Loading />;
  if (templatesQ.isError) return <ErrorState onRetry={() => templatesQ.refetch()} />;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">ข้อความตอบกลับ LINE</h1>
        <p className="text-sm text-muted-foreground">
          ออกแบบการ์ดที่ลูกค้าได้รับทาง LINE เมื่อจอง/ชำระเงิน/ยกเลิก — ลากจัดเรียงบล็อกแล้วดูตัวอย่างสด
        </p>
      </header>

      {/* Event switcher */}
      <div className="flex flex-wrap gap-1 border-b border-black/5">
        {EVENTS.map((e) => {
          const t = templatesQ.data?.find((x) => x.event === e.key);
          return (
            <button
              key={e.key}
              type="button"
              onClick={() => setEvent(e.key)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
                event === e.key ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {e.label}
              {t && !t.enabled && <span className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">ปิด</span>}
            </button>
          );
        })}
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">{EVENTS.find((e) => e.key === event)?.hint}</p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ---- Left: editor ---- */}
        <div className="space-y-4">
          {/* Enable + save */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
                className="size-4 accent-brand"
              />
              <span className="text-sm font-medium">ส่งการ์ดนี้ให้ลูกค้า</span>
            </label>
            <div className="flex items-center gap-3">
              {save.isSuccess && !dirty && (
                <span className="inline-flex items-center gap-1 text-sm font-medium text-brand">
                  <Check className="size-4" /> บันทึกแล้ว
                </span>
              )}
              {save.isError && <span className="text-sm text-brand-danger">บันทึกไม่สำเร็จ</span>}
              <Button type="button" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </div>
          </div>

          {/* Block list */}
          <div className="space-y-2">
            {draft.blocks.map((block, i) => (
              <BlockRow
                key={i}
                index={i}
                block={block}
                expanded={expanded === i}
                dropLine={dropLine?.index === i ? dropLine.pos : null}
                onToggle={() => setExpanded((e) => (e === i ? null : i))}
                onChange={(patch) => update(i, patch)}
                onRemove={() => remove(i)}
                onDuplicate={() => duplicate(i)}
                onMoveUp={() => move(i, i - 1)}
                onMoveDown={() => move(i, i + 1)}
                onDragStart={() => setDragIndex(i)}
                onDragOverRow={(pos) => {
                  if (dragIndex === null || dragIndex === i) {
                    setDropLine(null);
                    return;
                  }
                  setDropLine({ index: i, pos });
                }}
                onDrop={() => {
                  if (dragIndex !== null) reorderTo(dragIndex, dropLine?.pos === "below" ? i + 1 : i);
                  endDrag();
                }}
                onDragEnd={endDrag}
              />
            ))}
            {draft.blocks.length === 0 && (
              <p className="rounded-xl border border-dashed border-black/10 py-6 text-center text-sm text-muted-foreground">
                ยังไม่มีบล็อก — เพิ่มบล็อกด้านล่างเพื่อเริ่มออกแบบ
              </p>
            )}
          </div>

          {/* Add block */}
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="mb-2 text-sm font-semibold">เพิ่มบล็อก</div>
            <div className="flex flex-wrap gap-2">
              {ADD_ORDER.map((type) => {
                const Icon = BLOCK_META[type].icon;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => add(type)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-app px-3 py-1.5 text-sm font-medium ring-1 ring-black/10 transition hover:bg-brand/5 hover:ring-brand/30"
                  >
                    <Icon className="size-3.5" /> {BLOCK_META[type].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Placeholder palette */}
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="mb-1 text-sm font-semibold">ตัวแปร (คลิกเพื่อคัดลอก แล้ววางในช่องข้อความ)</div>
            <p className="mb-2.5 text-xs text-muted-foreground">ระบบจะแทนค่าจริงตอนส่ง เช่น {"{{customerName}}"} → ชื่อลูกค้า</p>
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map((p) => (
                <button
                  key={p.token}
                  type="button"
                  onClick={() => copyToken(p.token)}
                  title={p.token}
                  className="inline-flex items-center gap-1 rounded-lg bg-app px-2 py-1 text-xs ring-1 ring-black/10 transition hover:bg-brand/5"
                >
                  {copied === p.token ? <Check className="size-3 text-brand" /> : <Copy className="size-3 text-muted-foreground" />}
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---- Right: preview + test ---- */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl bg-app p-4 shadow-sm ring-1 ring-black/5">
            <div className="mb-3 text-center text-xs font-medium text-muted-foreground">ตัวอย่างบนมือถือ</div>
            <LineFlexPreview blocks={draft.blocks} />
          </div>
          <TestSend event={event} blocks={draft.blocks} dirty={dirty} />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Block row (list item + inline editor) ---------------- */

function BlockRow({
  index,
  block,
  expanded,
  dropLine,
  onToggle,
  onChange,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOverRow,
  onDrop,
  onDragEnd,
}: {
  index: number;
  block: LineBlock;
  expanded: boolean;
  dropLine: "above" | "below" | null;
  onToggle: () => void;
  onChange: (patch: Partial<LineBlock>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onDragOverRow: (pos: "above" | "below") => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const Icon = BLOCK_META[block.type].icon;
  const cardRef = useRef<HTMLDivElement>(null);

  // Start the drag with the WHOLE card as the ghost image (not just the small
  // handle/label that fired the event), so what you drag looks like the card.
  const startDrag = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
    if (cardRef.current) {
      const r = cardRef.current.getBoundingClientRect();
      e.dataTransfer.setDragImage(cardRef.current, e.clientX - r.left, e.clientY - r.top);
    }
    onDragStart();
  };

  return (
    <div
      className={`relative transition-[padding] duration-200 ${
        dropLine === "above" ? "pt-11" : dropLine === "below" ? "pb-11" : ""
      }`}
      // Drop is handled on the whole row (card + the gap that opens), so
      // releasing in the empty slot still lands the block there.
      onDragOver={(e) => {
        e.preventDefault();
        const rect = (cardRef.current ?? e.currentTarget).getBoundingClientRect();
        onDragOverRow(e.clientY < rect.top + rect.height / 2 ? "above" : "below");
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      {/* The gap that opens shows exactly where the dragged block will land. */}
      <DropIndicator show={dropLine === "above"} pos="top" />
      <DropIndicator show={dropLine === "below"} pos="bottom" />
      <div
        ref={cardRef}
        className="rounded-xl bg-white shadow-sm ring-1 ring-black/5"
      >
        <div className="flex select-none items-center gap-2 p-2.5">
          <span
            draggable
            onDragStart={startDrag}
            onDragEnd={onDragEnd}
            // The icon must not swallow the drag (an inline <svg> starts its own
            // image drag), and a bigger square is far easier to grab.
            className="grid size-8 shrink-0 cursor-grab place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-app hover:text-brand active:cursor-grabbing [&_svg]:pointer-events-none"
            title="ลากเพื่อจัดเรียง"
            aria-label="ลากเพื่อจัดเรียง"
          >
            <GripVertical className="size-4" />
          </span>
        <button
          type="button"
          onClick={onToggle}
          draggable
          onDragStart={startDrag}
          onDragEnd={onDragEnd}
          className="flex min-w-0 flex-1 cursor-grab items-center gap-2 text-left active:cursor-grabbing [&_svg]:pointer-events-none"
        >
          <Icon className="size-4 shrink-0 text-brand" />
          <span className="shrink-0 text-sm font-medium">{BLOCK_META[block.type].label}</span>
          <span className="truncate text-xs text-muted-foreground">{summarise(block)}</span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
          <IconBtn label="เลื่อนขึ้น" onClick={onMoveUp}><ChevronUp className="size-4" /></IconBtn>
          <IconBtn label="เลื่อนลง" onClick={onMoveDown}><ChevronDown className="size-4" /></IconBtn>
          <IconBtn label="ทำซ้ำ" onClick={onDuplicate}><Copy className="size-3.5" /></IconBtn>
          <IconBtn label="ลบ" onClick={onRemove}><Trash2 className="size-3.5 text-brand-danger" /></IconBtn>
        </div>
      </div>
        {expanded && block.type !== "divider" && (
          <div className="border-t border-black/5 p-3">
            <BlockEditor block={block} onChange={onChange} />
          </div>
        )}
      </div>
    </div>
  );
}

/** The pulsing "drop here" slot that opens where a dragged block will land. */
function DropIndicator({ show, pos }: { show: boolean; pos: "top" | "bottom" }) {
  if (!show) return null;
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 z-10 flex h-9 items-center justify-center rounded-xl border-2 border-dashed border-brand bg-brand/10 ${
        pos === "top" ? "top-0" : "bottom-0"
      }`}
    >
      <span className="animate-pulse text-xs font-semibold text-brand">วางตรงนี้</span>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid size-7 place-items-center rounded-lg hover:bg-app">
      {children}
    </button>
  );
}

/* ---------------- Per-type property editor ---------------- */

const SIZES = ["xs", "sm", "md", "lg", "xl", "xxl"];

function BlockEditor({ block, onChange }: { block: LineBlock; onChange: (patch: Partial<LineBlock>) => void }) {
  switch (block.type) {
    case "title":
    case "text":
      return (
        <div className="space-y-3">
          <Field label="ข้อความ">
            <textarea
              value={block.text ?? ""}
              onChange={(e) => onChange({ text: e.target.value })}
              rows={2}
              className="w-full rounded-xl bg-app px-3 py-2 text-sm ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SelectField label="ขนาด" value={block.size ?? (block.type === "title" ? "lg" : "sm")} options={SIZES} onChange={(v) => onChange({ size: v })} />
            <SelectField label="จัดวาง" value={block.align ?? "start"} options={["start", "center", "end"]} labels={{ start: "ซ้าย", center: "กลาง", end: "ขวา" }} onChange={(v) => onChange({ align: v as LineBlock["align"] })} />
            {block.type === "text" && (
              <SelectField label="หนา" value={block.weight ?? "regular"} options={["regular", "bold"]} labels={{ regular: "ปกติ", bold: "หนา" }} onChange={(v) => onChange({ weight: v === "bold" ? "bold" : undefined })} />
            )}
            <ColorField label="สี" value={block.color} onChange={(v) => onChange({ color: v })} />
          </div>
        </div>
      );
    case "infoRow":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="ป้ายกำกับ (ซ้าย)">
              <Input value={block.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} />
            </Field>
            <Field label="ค่า (ขวา)">
              <Input value={block.value ?? ""} onChange={(e) => onChange({ value: e.target.value })} />
            </Field>
          </div>
          <ColorField label="สีของค่า" value={block.color} onChange={(v) => onChange({ color: v })} />
        </div>
      );
    case "image":
    case "logo":
      return <ImageField block={block} onChange={onChange} />;
    case "button":
      return <ButtonFields button={block as unknown as LineButton} onChange={(patch) => onChange(patch as Partial<LineBlock>)} />;
    case "buttonRow":
      return <ButtonRowEditor block={block} onChange={onChange} />;
    default:
      return null;
  }
}

function ButtonRowEditor({ block, onChange }: { block: LineBlock; onChange: (patch: Partial<LineBlock>) => void }) {
  const buttons = block.buttons ?? [];
  const setBtn = (i: number, patch: Partial<LineButton>) =>
    onChange({ buttons: buttons.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) });
  return (
    <div className="space-y-3">
      {buttons.map((b, i) => (
        <div key={i} className="rounded-xl bg-app p-3 ring-1 ring-black/5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">ปุ่มที่ {i + 1}</span>
            {buttons.length > 1 && (
              <button type="button" onClick={() => onChange({ buttons: buttons.filter((_, idx) => idx !== i) })} className="text-xs text-brand-danger">
                ลบปุ่ม
              </button>
            )}
          </div>
          <ButtonFields button={b} onChange={(patch) => setBtn(i, patch)} />
        </div>
      ))}
      {buttons.length < 3 && (
        <button
          type="button"
          onClick={() => onChange({ buttons: [...buttons, { label: "ปุ่มใหม่", url: "{{bookingUrl}}", style: "secondary" }] })}
          className="inline-flex items-center gap-1 rounded-lg bg-app px-3 py-1.5 text-sm ring-1 ring-black/10 hover:bg-brand/5"
        >
          <Plus className="size-3.5" /> เพิ่มปุ่ม
        </button>
      )}
    </div>
  );
}

function ButtonFields({ button, onChange }: { button: LineButton; onChange: (patch: Partial<LineButton>) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="ข้อความบนปุ่ม">
          <Input value={button.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} />
        </Field>
        <Field label="ลิงก์ (URL)">
          <Input value={button.url ?? ""} placeholder="{{bookingUrl}} หรือ https://..." onChange={(e) => onChange({ url: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="สไตล์" value={button.style ?? "primary"} options={["primary", "secondary", "link"]} labels={{ primary: "ทึบ", secondary: "ขอบ", link: "ลิงก์" }} onChange={(v) => onChange({ style: v as LineButton["style"] })} />
        <ColorField label="สีปุ่ม" value={button.color} onChange={(v) => onChange({ color: v })} />
      </div>
      <p className="text-xs text-muted-foreground">ถ้าลิงก์ว่างหรือไม่ใช่ http(s) ปุ่มจะไม่ถูกส่ง (แต่การ์ดยังส่งได้)</p>
    </div>
  );
}

function ImageField({ block, onChange }: { block: LineBlock; onChange: (patch: Partial<LineBlock>) => void }) {
  const [uploading, setUploading] = useState(false);
  async function onFile(file: File) {
    setUploading(true);
    try {
      const url = await ownerApi.uploadImage(file);
      onChange({ url });
    } catch {
      /* ignore — owner can paste a URL instead */
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="space-y-2">
      <Field label="URL รูปภาพ">
        <Input value={block.url ?? ""} placeholder="https://..." onChange={(e) => onChange({ url: e.target.value })} />
      </Field>
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-app px-3 py-1.5 text-sm ring-1 ring-black/10 hover:bg-brand/5">
        <ImageIcon className="size-3.5" />
        {uploading ? "กำลังอัปโหลด..." : "อัปโหลดรูป"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>
      <p className="text-xs text-muted-foreground">LINE ต้องการรูปแบบ HTTPS — รูปที่อัปโหลดผ่านระบบใช้ได้เลย</p>
    </div>
  );
}

/* ---------------- Test send ---------------- */

function TestSend({ event, blocks, dirty }: { event: LineTemplateEvent; blocks: LineBlock[]; dirty: boolean }) {
  const customersQ = useQuery({ queryKey: ["owner", "customers"], queryFn: ownerApi.getCustomers });
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<OwnerCustomer | null>(null);

  const matches = useMemo(() => {
    const all = customersQ.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return all
      .filter((c) => c.displayName.toLowerCase().includes(needle) || (c.phone ?? "").includes(needle))
      .slice(0, 6);
  }, [customersQ.data, q]);

  const OUTCOME_MSG: Record<string, string> = {
    sent: "ส่งแล้ว — เปิด LINE ของลูกค้าเพื่อดูการ์ด",
    noToken: "สนามยังไม่ได้ตั้งค่า LINE token (ไปที่ ตั้งค่า › การเชื่อมต่อ)",
    noProfile: "ลูกค้ารายนี้ยังไม่ได้ผูกบัญชี LINE",
    failed: "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง",
  };

  const send = useMutation({
    mutationFn: () => ownerApi.testLineTemplate(event, { customerId: picked!.id, blocks }),
    onSuccess: (r) => {
      const m = OUTCOME_MSG[r.outcome] ?? r.outcome;
      if (r.outcome === "sent") toast.success(m);
      else toast.error(m);
    },
    onError: (e: Error) => toast.error(e.message || OUTCOME_MSG.failed),
  });

  const outcome = send.data?.outcome ?? (send.isError ? "failed" : null);

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div>
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <Send className="size-4 text-brand" /> ทดสอบส่งจริง
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">ส่งการ์ดนี้ (ใช้ข้อมูลตัวอย่าง) เข้า LINE ของลูกค้าที่เลือก</p>
      </div>

      {picked ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-app px-3 py-2">
          <span className="truncate text-sm font-medium">{picked.displayName}</span>
          <button type="button" onClick={() => setPicked(null)} className="text-xs text-muted-foreground hover:text-foreground">
            เปลี่ยน
          </button>
        </div>
      ) : (
        <div className="relative">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาลูกค้า (ชื่อ/เบอร์)" />
          {matches.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black/10">
              {matches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setPicked(c);
                    setQ("");
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-app"
                >
                  {c.displayName}
                  {c.phone && <span className="ml-2 text-xs text-muted-foreground">{c.phone}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Button type="button" variant="outline" disabled={!picked || send.isPending} onClick={() => send.mutate()} className="w-full">
        {send.isPending ? "กำลังส่ง..." : "ส่งทดสอบ"}
      </Button>

      {dirty && <p className="text-xs text-amber-600">กำลังทดสอบเวอร์ชันที่ยังไม่บันทึก</p>}
      {outcome && (
        <p className={`text-xs ${outcome === "sent" ? "text-brand" : "text-brand-danger"}`}>{OUTCOME_MSG[outcome] ?? outcome}</p>
      )}
    </div>
  );
}

/* ---------------- small form helpers ---------------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  labels?: Record<string, string>;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-xl bg-app px-2 text-sm ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-brand/40"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {labels?.[o] ?? o}
          </option>
        ))}
      </select>
    </Field>
  );
}

function ColorField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : "#111111"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-lg ring-1 ring-black/10"
          aria-label={label}
        />
        <Input value={value ?? ""} placeholder="#111111" onChange={(e) => onChange(e.target.value)} className="h-9" />
      </div>
    </Field>
  );
}
