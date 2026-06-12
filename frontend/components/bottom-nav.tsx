"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "หน้าหลัก" },
  { href: "/bookings", label: "การจอง" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md border-t bg-background">
      {items.map((it) => {
        const active = path === it.href;
        return (
          <Link key={it.href} href={it.href}
            className={`flex-1 py-3 text-center text-sm ${active ? "font-semibold text-brand" : "text-muted-foreground"}`}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
