"use client";
import { VenueLink as Link } from "@/lib/tenant/venue-nav";
import { Bell, Globe, Headphones, Info, ChevronRight, LogOut } from "lucide-react";
import type { ComponentType } from "react";
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
