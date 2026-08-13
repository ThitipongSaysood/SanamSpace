"use client";
import { toast } from "@/lib/toast";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Image as ImageIcon, LayoutGrid, Pencil, Plus, Power, Trash2, X } from "lucide-react";
import type { OwnerBranch, OwnerCourt, OwnerCourtBlock, SportMeta } from "@/lib/types";
import { ownerApi, type CourtInput } from "@/lib/api/owner";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMessages } from "@/lib/i18n/context";
import { fmt as interp } from "@/lib/i18n/format";

const COURTS_KEY = ["owner", "courts"];
const BRANCHES_KEY = ["owner", "branches"];
const fmt = new Intl.NumberFormat("th-TH");

// The sports come from the platform catalogue (GET /owner/sports). This file
// used to name four of them itself while the branch form next door was a
// free-text box and the customer app knew ten — so a venue could put "tennis"
// on its branch and have no way to create a tennis court.
const SPORTS_KEY = ["owner", "sports"];

/**
 * The options a court may be set to: everything the platform currently offers,
 * plus whatever this court already is.
 *
 * The second half matters — a sport switched off after a venue built courts on
 * it would otherwise vanish from the dropdown, so the next unrelated edit
 * (a price change, a photo) would quietly re-label the court as badminton.
 */
function sportOptions(catalogue: SportMeta[] | undefined, current: string): SportMeta[] {
  const list = catalogue ?? [];

  return list.some((s) => s.key === current) || !current
    ? list
    : [...list, { key: current, name: current, emoji: "🏟️", color: "#64748b" }];
}

function sportName(catalogue: SportMeta[] | undefined, key: string): string {
  return catalogue?.find((s) => s.key === key)?.name ?? key;
}

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default function OwnerCourtsPage() {
  const t = useMessages("owner").courts;
  const courts = useQuery({ queryKey: COURTS_KEY, queryFn: ownerApi.getCourts });
  const branches = useQuery({ queryKey: BRANCHES_KEY, queryFn: ownerApi.getBranches });
  const sports = useQuery({ queryKey: SPORTS_KEY, queryFn: ownerApi.getSports });
  // null = list · "new" = create · OwnerCourt = edit. Form renders full-width.
  const [editing, setEditing] = useState<OwnerCourt | "new" | null>(null);

  const branchList = branches.data ?? [];
  const sportList = sports.data ?? [];
  const noBranch = !branches.isLoading && branchList.length === 0;

  if (editing) {
    return (
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">
            {editing === "new" ? t.addTitle : t.editTitle}
          </h1>
          <p className="text-sm text-muted-foreground">{t.formSubtitle}</p>
        </header>
        <CourtForm
          court={editing === "new" ? undefined : editing}
          branches={branchList}
          onClose={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        {!noBranch && (
          <Button type="button" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> {t.add}
          </Button>
        )}
      </header>

      {noBranch && <EmptyState message={t.noBranch} />}

      {courts.isLoading && <Loading />}
      {courts.isError && <ErrorState onRetry={() => courts.refetch()} />}
      {courts.data && courts.data.length === 0 && !noBranch && (
        <EmptyState message={t.empty} />
      )}

      {courts.data && courts.data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courts.data.map((c) => (
            <CourtCard key={c.id} court={c} sports={sportList} onEdit={() => setEditing(c)} />
          ))}
        </div>
      )}
    </div>
  );
}

type FormState = {
  branchId: string;
  name: string;
  sport: string;
  pricePerHour: string;
  imageUrl: string;
  floor: string;
  aircon: string;
  lighting: string;
};

// Inline create form (also reused for editing when `court` is provided).
function CourtForm({
  court,
  branches,
  onClose,
}: {
  court?: OwnerCourt;
  branches: OwnerBranch[];
  onClose: () => void;
}) {
  const t = useMessages("owner").courts;
  const qc = useQueryClient();
  const sports = useQuery({ queryKey: SPORTS_KEY, queryFn: ownerApi.getSports });
  const [form, setForm] = useState<FormState>(
    court
      ? {
          branchId: court.branchId,
          name: court.name,
          sport: court.sport,
          pricePerHour: String(court.pricePerHour),
          imageUrl: court.imageUrl ?? "",
          floor: court.spec?.floor ?? "",
          aircon: court.spec?.aircon ?? "",
          lighting: court.spec?.lighting ?? "",
        }
      : {
          branchId: branches[0]?.id ?? "",
          name: "",
          sport: "badminton",
          pricePerHour: "",
          imageUrl: "",
          floor: "",
          aircon: "",
          lighting: "",
        },
  );

  const [imgBusy, setImgBusy] = useState(false);
  async function onCourtImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImgBusy(true);
    try {
      const url = await ownerApi.uploadImage(file);
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch {
      /* ignore */
    } finally {
      setImgBusy(false);
    }
  }

  const mutation = useMutation({
    mutationFn: () => {
      const payload: CourtInput = {
        branchId: form.branchId,
        name: form.name.trim(),
        sport: form.sport,
        pricePerHour: Number(form.pricePerHour) || 0,
        imageUrl: form.imageUrl || null,
        floor: form.floor.trim() || null,
        aircon: form.aircon.trim() || null,
        lighting: form.lighting.trim() || null,
      };
      return court ? ownerApi.updateCourt(court.id, payload) : ownerApi.createCourt(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COURTS_KEY });
      onClose();
    },
  });

  const valid = form.branchId !== "" && form.name.trim() !== "" && form.pricePerHour !== "";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (valid) mutation.mutate();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{court ? t.editTitle : t.addTitle}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-app"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{t.imageLabel}</Label>
          <div className="flex items-center gap-3">
            {form.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.imageUrl} alt="" className="size-16 rounded-lg object-cover ring-1 ring-black/10" />
            ) : (
              <div className="grid size-16 place-items-center rounded-lg bg-app text-muted-foreground ring-1 ring-black/10">
                <ImageIcon className="size-5" />
              </div>
            )}
            <label className="cursor-pointer rounded-lg border border-input px-3 py-1.5 text-sm hover:bg-app">
              {imgBusy ? t.uploading : t.upload}
              <input type="file" accept="image/*" className="hidden" onChange={onCourtImage} disabled={imgBusy} />
            </label>
            {form.imageUrl && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                className="text-sm text-muted-foreground hover:text-brand-danger"
              >
                {t.remove}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="court-branch">{t.branchLabel}</Label>
          <select
            id="court-branch"
            value={form.branchId}
            onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
            className={selectClass}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="court-name">{t.nameLabel}</Label>
          <Input
            id="court-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t.namePlaceholder}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="court-sport">{t.sportLabel}</Label>
          <select
            id="court-sport"
            value={form.sport}
            onChange={(e) => setForm((f) => ({ ...f, sport: e.target.value }))}
            className={selectClass}
          >
            {/* A court being edited may hold a sport the platform has since
                switched off. Keeping it as an option means saving anything
                else on this court does not silently change what it is. */}
            {sportOptions(sports.data, form.sport).map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="court-price">{t.priceLabel}</Label>
          <Input
            id="court-price"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.pricePerHour}
            onChange={(e) => setForm((f) => ({ ...f, pricePerHour: e.target.value }))}
            placeholder={t.pricePlaceholder}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="court-floor">{t.floorLabel}</Label>
          <Input
            id="court-floor"
            value={form.floor}
            onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))}
            placeholder={t.floorPlaceholder}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="court-aircon">{t.airconLabel}</Label>
          <Input
            id="court-aircon"
            value={form.aircon}
            onChange={(e) => setForm((f) => ({ ...f, aircon: e.target.value }))}
            placeholder={t.airconPlaceholder}
          />
        </div>
      </div>

      {mutation.isError && (
        <p className="text-sm text-brand-danger">{t.saveFailed}</p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={mutation.isPending || !valid}>
          {mutation.isPending ? t.saving : t.save}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}

function CourtCard({ court, sports, onEdit }: { court: OwnerCourt; sports: SportMeta[]; onEdit: () => void }) {
  const t = useMessages("owner").courts;
  const qc = useQueryClient();
  const [blocksOpen, setBlocksOpen] = useState(false);

  const toggle = useMutation({
    mutationFn: () => ownerApi.toggleCourt(court.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: COURTS_KEY }),
  });
  const del = useMutation({
    mutationFn: () => ownerApi.deleteCourt(court.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: COURTS_KEY }),
  });

  function onDelete() {
    if (window.confirm(interp(t.deleteConfirm, { name: court.name }))) del.mutate();
  }

  const closed = court.status !== "active";

  return (
    <div className="flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-2">
        {court.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={court.imageUrl} alt="" className="size-11 shrink-0 rounded-xl object-cover ring-1 ring-black/10" />
        ) : (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
            <LayoutGrid className="size-5" />
          </span>
        )}
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            closed ? "bg-muted text-muted-foreground" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {closed ? t.statusClosed : t.statusOpen}
        </span>
      </div>

      <div className="mt-3 flex-1">
        <div className="font-semibold">{court.name}</div>
        <div className="mt-0.5 text-sm text-muted-foreground">
          {sportName(sports, court.sport)}
          {court.branchName ? ` · ${court.branchName}` : ""}
        </div>
        <div className="mt-2 text-lg font-bold text-brand">
          ฿{fmt.format(court.pricePerHour)}
          <span className="ml-1 text-xs font-medium text-muted-foreground">{t.perHour}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-black/5 pt-3">
        <Button type="button" size="sm" variant="outline" onClick={onEdit}>
          <Pencil className="size-4" /> {t.edit}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
        >
          <Power className="size-4" /> {closed ? t.statusOpen : t.statusClosed}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setBlocksOpen(true)}>
          <Ban className="size-4" /> {t.maintenance}
        </Button>
        <button
          type="button"
          onClick={onDelete}
          disabled={del.isPending}
          aria-label={t.deleteAria}
          className="ml-auto grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-app hover:text-brand-danger disabled:opacity-50"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {blocksOpen && <CourtBlocksModal court={court} onClose={() => setBlocksOpen(false)} />}
    </div>
  );
}

function CourtBlocksModal({ court, onClose }: { court: OwnerCourt; onClose: () => void }) {
  const t = useMessages("owner").courts;
  const qc = useQueryClient();
  const key = ["owner", "court-blocks", court.id];
  const { data: blocks } = useQuery({ queryKey: key, queryFn: () => ownerApi.getCourtBlocks(court.id) });

  const [date, setDate] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["owner", "court-blocks"] });
  };

  const create = useMutation({
    mutationFn: () =>
      ownerApi.createCourtBlock({
        courtId: court.id,
        date,
        start: allDay ? undefined : start || undefined,
        end: allDay ? undefined : end || undefined,
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setDate(""); setStart(""); setEnd(""); setReason(""); setAllDay(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => ownerApi.deleteCourtBlock(id),
    onSuccess: invalidate,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{interp(t.blocksTitle, { name: court.name })}</h2>
          <button type="button" onClick={onClose} aria-label={t.close} className="grid size-8 place-items-center rounded-lg hover:bg-app">
            <X className="size-4" />
          </button>
        </div>

        {/* Existing blocks */}
        <div className="mt-3 space-y-2">
          {(blocks ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t.noBlocks}</p>}
          {(blocks ?? []).map((b: OwnerCourtBlock) => (
            <div key={b.id} className="flex items-center gap-2 rounded-lg bg-app px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{b.date}{b.start ? ` · ${b.start}–${b.end}` : ` · ${t.allDayLabel}`}</div>
                {b.reason && <div className="truncate text-xs text-muted-foreground">{b.reason}</div>}
              </div>
              <button type="button" onClick={() => del.mutate(b.id)} disabled={del.isPending} aria-label={t.deleteBlockAria} className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-white hover:text-brand-danger">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add block */}
        <div className="mt-4 space-y-3 border-t border-black/5 pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="cb-date">{t.dateLabel}</Label>
            <Input id="cb-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-4 accent-[var(--brand-primary)]" />
            {t.closeAllDay}
          </label>
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="cb-start">{t.fromLabel}</Label><Input id="cb-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="cb-end">{t.toLabel}</Label><Input id="cb-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="cb-reason">{t.reasonLabel}</Label>
            <Input id="cb-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.reasonPlaceholder} />
          </div>
          <Button type="button" className="w-full" disabled={!date || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? t.saving : t.addBlock}
          </Button>
        </div>
      </div>
    </div>
  );
}
