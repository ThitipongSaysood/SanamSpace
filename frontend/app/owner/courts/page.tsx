"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Pencil, Plus, Power, Trash2, X } from "lucide-react";
import type { OwnerBranch, OwnerCourt, Sport } from "@/lib/types";
import { ownerApi, type CourtInput } from "@/lib/api/owner";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const COURTS_KEY = ["owner", "courts"];
const BRANCHES_KEY = ["owner", "branches"];
const fmt = new Intl.NumberFormat("th-TH");

const SPORTS: Sport[] = ["badminton", "football", "futsal", "tennis"];
const SPORT_LABEL: Record<string, string> = {
  badminton: "แบดมินตัน",
  football: "ฟุตบอล",
  futsal: "ฟุตซอล",
  tennis: "เทนนิส",
};

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default function OwnerCourtsPage() {
  const courts = useQuery({ queryKey: COURTS_KEY, queryFn: ownerApi.getCourts });
  const branches = useQuery({ queryKey: BRANCHES_KEY, queryFn: ownerApi.getBranches });
  const [adding, setAdding] = useState(false);

  const branchList = branches.data ?? [];
  const noBranch = !branches.isLoading && branchList.length === 0;

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">คอร์ท</h1>
          <p className="text-sm text-muted-foreground">เพิ่ม / แก้ไข / ลบ / เปิด-ปิด คอร์ท</p>
        </div>
        {!adding && !noBranch && (
          <Button type="button" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> เพิ่มคอร์ท
          </Button>
        )}
      </header>

      {noBranch && <EmptyState message="ต้องสร้างสนาม (สาขา) ก่อน จึงจะเพิ่มคอร์ทได้" />}

      {adding && <CourtForm branches={branchList} onClose={() => setAdding(false)} />}

      {courts.isLoading && <Loading />}
      {courts.isError && <ErrorState onRetry={() => courts.refetch()} />}
      {courts.data && courts.data.length === 0 && !adding && !noBranch && (
        <EmptyState message="ยังไม่มีคอร์ท" />
      )}

      {courts.data && courts.data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courts.data.map((c) => (
            <CourtCard key={c.id} court={c} branches={branchList} />
          ))}
        </div>
      )}
    </div>
  );
}

type FormState = {
  branchId: string;
  name: string;
  sport: Sport;
  pricePerHour: string;
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
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(
    court
      ? {
          branchId: court.branchId,
          name: court.name,
          sport: court.sport,
          pricePerHour: String(court.pricePerHour),
          floor: court.spec?.floor ?? "",
          aircon: court.spec?.aircon ?? "",
          lighting: court.spec?.lighting ?? "",
        }
      : {
          branchId: branches[0]?.id ?? "",
          name: "",
          sport: "badminton",
          pricePerHour: "",
          floor: "",
          aircon: "",
          lighting: "",
        },
  );

  const mutation = useMutation({
    mutationFn: () => {
      const payload: CourtInput = {
        branchId: form.branchId,
        name: form.name.trim(),
        sport: form.sport,
        pricePerHour: Number(form.pricePerHour) || 0,
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
        <h2 className="text-sm font-semibold">{court ? "แก้ไขคอร์ท" : "เพิ่มคอร์ท"}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-app"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="court-branch">สนาม (สาขา)</Label>
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
          <Label htmlFor="court-name">ชื่อคอร์ท</Label>
          <Input
            id="court-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="เช่น คอร์ท 1"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="court-sport">กีฬา</Label>
          <select
            id="court-sport"
            value={form.sport}
            onChange={(e) => setForm((f) => ({ ...f, sport: e.target.value as Sport }))}
            className={selectClass}
          >
            {SPORTS.map((s) => (
              <option key={s} value={s}>
                {SPORT_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="court-price">ราคา / ชม. (บาท)</Label>
          <Input
            id="court-price"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.pricePerHour}
            onChange={(e) => setForm((f) => ({ ...f, pricePerHour: e.target.value }))}
            placeholder="เช่น 250"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="court-floor">พื้น (ไม่บังคับ)</Label>
          <Input
            id="court-floor"
            value={form.floor}
            onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))}
            placeholder="เช่น พื้นยาง BWF"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="court-aircon">แอร์ (ไม่บังคับ)</Label>
          <Input
            id="court-aircon"
            value={form.aircon}
            onChange={(e) => setForm((f) => ({ ...f, aircon: e.target.value }))}
            placeholder="เช่น แอร์เย็น"
          />
        </div>
      </div>

      {mutation.isError && (
        <p className="text-sm text-brand-danger">บันทึกไม่สำเร็จ ลองอีกครั้ง</p>
      )}

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

function CourtCard({ court, branches }: { court: OwnerCourt; branches: OwnerBranch[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const toggle = useMutation({
    mutationFn: () => ownerApi.toggleCourt(court.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: COURTS_KEY }),
  });
  const del = useMutation({
    mutationFn: () => ownerApi.deleteCourt(court.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: COURTS_KEY }),
  });

  function onDelete() {
    if (window.confirm(`ลบคอร์ท "${court.name}" ?`)) del.mutate();
  }

  if (editing) {
    return <CourtForm court={court} branches={branches} onClose={() => setEditing(false)} />;
  }

  const closed = court.status !== "active";

  return (
    <div className="flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
          <LayoutGrid className="size-5" />
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            closed ? "bg-muted text-muted-foreground" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {closed ? "ปิด" : "เปิด"}
        </span>
      </div>

      <div className="mt-3 flex-1">
        <div className="font-semibold">{court.name}</div>
        <div className="mt-0.5 text-sm text-muted-foreground">
          {SPORT_LABEL[court.sport] ?? court.sport}
          {court.branchName ? ` · ${court.branchName}` : ""}
        </div>
        <div className="mt-2 text-lg font-bold text-brand">
          ฿{fmt.format(court.pricePerHour)}
          <span className="ml-1 text-xs font-medium text-muted-foreground">/ ชม.</span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-black/5 pt-3">
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
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
          aria-label="ลบคอร์ท"
          className="ml-auto grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-app hover:text-brand-danger disabled:opacity-50"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}
