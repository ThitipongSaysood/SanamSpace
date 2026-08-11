"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { superAdminApi, SuperAdminApiError } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import type { PlatformSport } from "@/lib/types";

const KEY = ["admin", "sports"];

type Draft = { key: string; name: string; emoji: string; color: string };

const BLANK: Draft = { key: "", name: "", emoji: "🏟️", color: "#10b981" };

/**
 * The platform's sport catalogue.
 *
 * This screen exists because the list did not. The same sports were written by
 * hand into six files and no two agreed: the customer app's loading screen knew
 * ten, its notification icon knew twelve, and the dropdown a venue actually
 * picks from offered four — so a venue renting pickleball could not create a
 * court for it even though the icon was already in the code.
 *
 * The emoji and the colour live here rather than in those files because they
 * are the reason this needs an owner: adding a sport used to mean a release.
 */
export default function AdminSportsPage() {
  const qc = useQueryClient();
  const sportsQ = useQuery({ queryKey: KEY, queryFn: superAdminApi.getSports });
  const [editing, setEditing] = useState<PlatformSport | "new" | null>(null);

  const sports = sportsQ.data ?? [];

  const toggle = useMutation({
    mutationFn: (s: PlatformSport) => superAdminApi.updateSport(s.id, { is_active: !s.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (s: PlatformSport) => superAdminApi.deleteSport(s.id),
    onSuccess: () => {
      toast.success("ลบประเภทกีฬาแล้ว");
      qc.invalidateQueries({ queryKey: KEY });
    },
    // The API refuses while any venue still names it. Surfacing its own words
    // is better than a generic failure: the reason is the whole message.
    onError: (e: Error) => toast.error(errorText(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">ประเภทกีฬา</h1>
          <p className="text-sm text-muted-foreground">
            รายการกลางของทั้งแพลตฟอร์ม — สนามเลือกจากรายการนี้ และแอปลูกค้าใช้ไอคอนกับสีจากที่นี่
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" /> เพิ่มประเภทกีฬา
        </Button>
      </div>

      {editing && (
        <SportForm
          sport={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {sportsQ.isLoading && <Loading />}
      {sportsQ.isError && <ErrorState onRetry={() => sportsQ.refetch()} />}
      {sports.length === 0 && !sportsQ.isLoading && <EmptyState message="ยังไม่มีประเภทกีฬา" />}

      {sports.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full text-sm md:min-w-[720px]">
              <thead className="bg-app text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">กีฬา</th>
                  <th className="px-4 py-3 text-left">รหัส</th>
                  <th className="px-4 py-3 text-center">สี</th>
                  <th className="px-4 py-3 text-center">สนามที่ใช้</th>
                  <th className="px-4 py-3 text-center">สถานะ</th>
                  <th className="px-4 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {sports.map((s) => (
                  <tr key={s.id} className={`hover:bg-app/40 ${s.isActive ? "" : "opacity-60"}`}>
                    <td data-label="กีฬา" className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl" aria-hidden>
                          {s.emoji}
                        </span>
                        <span className="font-medium">{s.name}</span>
                      </div>
                    </td>
                    <td data-label="รหัส" className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                      {s.key}
                    </td>
                    <td data-label="สี" className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="size-4 rounded-full ring-1 ring-black/10"
                          style={{ background: s.color }}
                        />
                        <span className="font-mono text-[11px] text-muted-foreground">{s.color}</span>
                      </span>
                    </td>
                    <td data-label="สนามที่ใช้" className="px-4 py-3 text-center">
                      {s.venueCount}
                    </td>
                    <td data-label="สถานะ" className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggle.mutate(s)}
                        disabled={toggle.isPending}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          s.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {s.isActive ? "เปิด" : "ปิด"}
                      </button>
                    </td>
                    <td data-label="จัดการ" className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={remove.isPending}
                          onClick={() => {
                            if (window.confirm(`ลบ "${s.name}" ?`)) remove.mutate(s);
                          }}
                        >
                          <Trash2 className="size-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        ปิดการใช้งาน = ซ่อนจากรายการที่สนามเลือกได้ แต่สนามที่ใช้อยู่แล้วยังใช้ต่อได้ตามปกติ ·
        ลบได้เฉพาะกีฬาที่ยังไม่มีสนามไหนใช้
      </p>
    </div>
  );
}

/** Laravel returns 422 with a message; anything else is its own words. */
function errorText(e: Error): string {
  return e instanceof SuperAdminApiError ? e.message : "ลบไม่สำเร็จ";
}

function SportForm({ sport, onClose }: { sport?: PlatformSport; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Draft>(
    sport ? { key: sport.key, name: sport.name, emoji: sport.emoji, color: sport.color } : BLANK,
  );

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () =>
      sport
        ? superAdminApi.updateSport(sport.id, form)
        : superAdminApi.createSport(form),
    onSuccess: () => {
      toast.success(sport ? "บันทึกแล้ว" : "เพิ่มประเภทกีฬาแล้ว");
      qc.invalidateQueries({ queryKey: KEY });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{sport ? `แก้ไข ${sport.name}` : "เพิ่มประเภทกีฬา"}</h2>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="s-name">ชื่อที่แสดง</Label>
          <Input id="s-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="แบดมินตัน" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="s-key">รหัส (a-z, ตัวเลข, _)</Label>
          <Input
            id="s-key"
            value={form.key}
            onChange={(e) => set("key", e.target.value)}
            placeholder="badminton"
            className="font-mono"
          />
          {/* Changing it after venues have chosen it would orphan their courts,
              which store the key as a plain string with nothing enforcing it. */}
          <p className="text-xs text-muted-foreground">
            {sport ? "เปลี่ยนรหัสจะทำให้คอร์ทที่ใช้รหัสเดิมหาไม่เจอ — เปลี่ยนเมื่อจำเป็นเท่านั้น" : "ใช้อ้างอิงภายใน เปลี่ยนภายหลังได้ยาก"}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="s-emoji">ไอคอน (emoji)</Label>
          <Input
            id="s-emoji"
            value={form.emoji}
            onChange={(e) => set("emoji", e.target.value)}
            placeholder="🏸"
            className="text-xl"
          />
          <p className="text-xs text-muted-foreground">ใช้ในหน้าโหลดของแอปลูกค้าและไอคอนแจ้งเตือน</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="s-color">สี</Label>
          <div className="flex items-center gap-2">
            <input
              id="s-color"
              type="color"
              value={form.color}
              onChange={(e) => set("color", e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-lg border border-input bg-transparent"
            />
            <Input value={form.color} onChange={(e) => set("color", e.target.value)} className="font-mono" />
          </div>
        </div>
      </div>

      {/* What the venue's customers will actually see. */}
      <div className="flex items-center gap-3 rounded-xl bg-app px-4 py-3">
        <span className="text-3xl" aria-hidden>
          {form.emoji || "🏟️"}
        </span>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-sm font-medium" style={{ color: form.color }}>
          {form.name || "ชื่อกีฬา"}
        </span>
        <span className="text-xs text-muted-foreground">ตัวอย่างบนหน้าโหลดของแอป</span>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button type="submit" disabled={save.isPending || !form.name.trim() || !form.key.trim()}>
          {save.isPending ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </div>
    </form>
  );
}
