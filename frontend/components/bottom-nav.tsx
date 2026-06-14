"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarCheck, Bell, User } from "lucide-react";

const items = [
  { href: "/", label: "หน้าหลัก", icon: Home },
  { href: "/bookings", label: "การจอง", icon: CalendarCheck },
  { href: "/notifications", label: "แจ้งเตือน", icon: Bell },
  { href: "/profile", label: "โปรไฟล์", icon: User },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-black/5 bg-white/95 backdrop-blur">
      {items.map(({ href, label, icon: Icon }) => {
        const active = path === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
              active ? "text-brand" : "text-muted-foreground"
            }`}
          >
            <Icon className={`size-5 ${active ? "fill-brand/15" : ""}`} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
