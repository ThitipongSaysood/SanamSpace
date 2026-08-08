"use client";
import { VenueLink as Link } from "@/lib/tenant/venue-nav";
import { Bell, Globe, Headphones, Info, ChevronRight, Download, LogOut, Trash2 } from "lucide-react";
import type { ComponentType } from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { AppHeader } from "@/components/app-header";

function Toggle({
  on,
  onToggle,
  disabled,
}: {
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${on ? "bg-brand" : "bg-black/15"}`}
    >
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
        <Icon className="size-4.5" />
      </span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { logout } = useAuth();
  const qc = useQueryClient();

  // The venue's marketing opt-out. This used to be `useState(true)` — a switch
  // that turned nothing off, which is worse than not offering one.
  const { data: consent, isLoading } = useQuery({
    queryKey: ["me", "consent"],
    queryFn: api.getConsent,
  });

  const save = useMutation({
    mutationFn: (granted: boolean) => api.setConsent(granted),
    // Written straight into the cache: the switch should land where the server
    // says it landed, not where the tap assumed.
    onSuccess: (next) => qc.setQueryData(["me", "consent"], next),
  });

  const promoOn = consent?.marketingAllowed ?? true;

  return (
    <main className="pb-6">
      <AppHeader title="การตั้งค่า" />
      <div className="space-y-4 p-4">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <Row icon={Bell} label="แจ้งเตือนโปรโมชั่น">
            <Toggle
              on={promoOn}
              disabled={isLoading || save.isPending}
              onToggle={() => save.mutate(!promoOn)}
            />
          </Row>
          <p className="px-4 pb-3 text-xs text-muted-foreground">
            {promoOn
              ? "สนามจะส่งข่าวโปรโมชั่นถึงคุณได้ ปิดเมื่อไหร่ก็ได้"
              : "ปิดรับข่าวโปรโมชั่นแล้ว — การแจ้งเตือนเรื่องการจองของคุณยังส่งตามปกติ"}
          </p>
          {save.isError && (
            <p className="px-4 pb-3 text-xs text-brand-danger">บันทึกไม่สำเร็จ ลองอีกครั้ง</p>
          )}
          <div className="border-t border-black/5" />
          <Row icon={Globe} label="ภาษา">
            <span className="text-sm text-muted-foreground">ไทย</span>
          </Row>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <Link href="/contact" className="block transition active:bg-black/[0.03]">
            <Row icon={Headphones} label="ติดต่อเรา">
              <ChevronRight className="size-4 text-muted-foreground" />
            </Row>
          </Link>
          <div className="border-t border-black/5" />
          <Row icon={Info} label="เกี่ยวกับแอป">
            <span className="text-sm text-muted-foreground">เวอร์ชัน 1.0.0</span>
          </Row>
        </div>

        <MyDataSection />

        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-semibold text-brand-danger shadow-sm ring-1 ring-black/5 transition active:bg-black/[0.03]"
        >
          <LogOut className="size-4.5" /> ออกจากระบบ
        </button>
      </div>
    </main>
  );
}

/**
 * The two PDPA rights that need a button: get a copy, and be erased.
 *
 * Both live here rather than behind a "legal" link, because a right nobody can
 * find is not much of a right.
 */
function MyDataSection() {
  const { user, logout } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [typedName, setTypedName] = useState("");

  const download = useMutation({
    mutationFn: api.exportMyData,
    onSuccess: (json) => {
      // Saved from a blob rather than linking at the endpoint: the request
      // needs the auth header, and a plain <a href> cannot carry one.
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `ข้อมูลของฉัน-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const erase = useMutation({
    mutationFn: () => api.deleteMyAccount(typedName),
    // Nothing is left to be signed in as.
    onSuccess: () => logout(),
  });

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <button
        type="button"
        onClick={() => download.mutate()}
        disabled={download.isPending}
        className="block w-full text-left transition active:bg-black/[0.03] disabled:opacity-50"
      >
        <Row icon={Download} label={download.isPending ? "กำลังเตรียมไฟล์…" : "ดาวน์โหลดข้อมูลของฉัน"}>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Row>
      </button>
      <p className="px-4 pb-3 text-xs text-muted-foreground">
        ไฟล์ JSON รวมโปรไฟล์ ประวัติการจอง การชำระเงิน วอลเล็ต และแต้มสมาชิกของคุณ
      </p>
      {download.isError && (
        <p className="px-4 pb-3 text-xs text-brand-danger">ดาวน์โหลดไม่สำเร็จ ลองอีกครั้ง</p>
      )}

      <div className="border-t border-black/5" />

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="block w-full text-left transition active:bg-black/[0.03]"
        >
          <Row icon={Trash2} label="ลบข้อมูลส่วนบุคคลของฉัน">
            <ChevronRight className="size-4 text-muted-foreground" />
          </Row>
        </button>
      ) : (
        <div className="space-y-3 p-4">
          <p className="text-sm font-medium">ยืนยันการลบข้อมูล</p>
          {/* Said plainly, because "delete my account" and "delete everything
              about me" are not the same thing here, and finding that out later
              would feel like a broken promise. */}
          <p className="text-xs text-muted-foreground">
            ชื่อ เบอร์โทร อีเมล รูปโปรไฟล์ และการเชื่อมต่อ LINE จะถูกลบถาวร
            <br />
            ประวัติการจองและการชำระเงินจะถูก<strong>เก็บไว้ตามกฎหมายบัญชี</strong> แต่จะไม่ผูกกับตัวคุณอีกต่อไป
            <br />
            ลบแล้วกู้คืนไม่ได้ และคุณจะออกจากระบบทุกเครื่องทันที
          </p>
          <div className="space-y-1.5">
            <label htmlFor="confirm-name" className="text-xs text-muted-foreground">
              พิมพ์ชื่อของคุณ “{user?.displayName}” เพื่อยืนยัน
            </label>
            <input
              id="confirm-name"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand"
              placeholder={user?.displayName ?? ""}
            />
          </div>
          {erase.isError && (
            <p className="text-xs text-brand-danger">{(erase.error as Error).message}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setTypedName("");
              }}
              className="h-11 rounded-xl text-sm font-semibold ring-1 ring-black/10"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              disabled={erase.isPending || typedName.trim() !== (user?.displayName ?? "").trim()}
              onClick={() => erase.mutate()}
              className="h-11 rounded-xl bg-brand-danger text-sm font-semibold text-white disabled:opacity-40"
            >
              {erase.isPending ? "กำลังลบ…" : "ลบถาวร"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
