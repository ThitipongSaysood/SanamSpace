"use client";
import { VenueLink as Link } from "@/lib/tenant/venue-nav";
import {
  CalendarCheck, ChevronRight, Headphones, LogOut, Package, Settings, Star, UserRound, Wallet,
} from "lucide-react";
import type { ComponentType } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useMembership } from "@/lib/api/queries";
import { Avatar } from "@/components/avatar";

type Item = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  href?: string;
};

const MENU: Item[] = [
  { icon: UserRound, label: "ข้อมูลส่วนตัว", href: "/profile/info" },
  { icon: CalendarCheck, label: "การจองของฉัน", href: "/bookings" },
  { icon: Package, label: "แพ็กเกจของฉัน", href: "/packages" },
  { icon: Wallet, label: "วอลเล็ต", href: "/wallet" },
  { icon: Star, label: "คะแนนของฉัน", href: "/membership" },
  { icon: Headphones, label: "ติดต่อเรา", href: "/contact" },
  { icon: Settings, label: "การตั้งค่า", href: "/settings" },
];

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { data: membership } = useMembership();
  if (!user) return null;
  return (
    <main className="p-4">
      <h1 className="mb-3 text-lg font-bold">โปรไฟล์</h1>

      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-brand/10 text-xl font-bold text-brand">
          <Avatar src={user.avatarUrl} name={user.displayName} />
        </div>
        <div className="min-w-0">
          <div className="truncate font-semibold">{user.displayName}</div>
          <div className="truncate text-xs text-muted-foreground">
            {membership?.memberId ?? "ED-0001234"}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        {MENU.map(({ icon: Icon, label, href }) => {
          const row = (
            <>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                <Icon className="size-4.5" />
              </span>
              <span className="flex-1 text-left text-sm font-medium">{label}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </>
          );
          const cls =
            "flex w-full items-center gap-3 border-b border-black/5 px-4 py-3 transition active:bg-black/[0.03]";
          return href ? (
            <Link key={label} href={href} className={cls}>
              {row}
            </Link>
          ) : (
            <button key={label} type="button" className={cls}>
              {row}
            </button>
          );
        })}
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 px-4 py-3 text-brand-danger transition active:bg-black/[0.03]"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-danger/10">
            <LogOut className="size-4.5" />
          </span>
          <span className="flex-1 text-left text-sm font-medium">ออกจากระบบ</span>
        </button>
      </div>
    </main>
  );
}
