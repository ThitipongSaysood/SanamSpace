"use client";
import { Mail, MapPin, MessageCircle, Phone, ThumbsUp } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { tenant } from "@/config/tenant";

const ROWS = [
  {
    icon: Phone,
    iconCls: "bg-brand/10 text-brand",
    label: "โทรศัพท์",
    value: tenant.phone,
    href: `tel:${tenant.phone}`,
  },
  {
    icon: MessageCircle,
    iconCls: "bg-emerald-100 text-emerald-600",
    label: "LINE",
    value: tenant.lineId,
    href: `https://line.me/R/ti/p/${tenant.lineId}`,
    external: true,
  },
  {
    icon: ThumbsUp,
    iconCls: "bg-blue-100 text-blue-600",
    label: "Facebook",
    value: tenant.facebook,
    href: "https://www.facebook.com/",
    external: true,
  },
  {
    icon: Mail,
    iconCls: "bg-sky-100 text-sky-600",
    label: "อีเมล",
    value: tenant.email,
    href: `mailto:${tenant.email}`,
  },
  {
    icon: MapPin,
    iconCls: "bg-black/5 text-foreground",
    label: "ที่อยู่",
    value: tenant.addressNote,
    href: `https://maps.google.com/?q=${encodeURIComponent(tenant.addressNote)}`,
    external: true,
  },
];

export default function ContactPage() {
  return (
    <main className="pb-6">
      <AppHeader title="ติดต่อเรา" />
      <div className="p-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-1 font-semibold">ช่องทางติดต่อ</h2>
          {ROWS.map(({ icon: Icon, iconCls, label, value, href, external }, i) => {
            const cls = `flex items-center gap-3 py-3 ${
              i < ROWS.length - 1 ? "border-b border-black/5" : ""
            }`;
            return (
              <a
                key={label}
                href={href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                className={cls}
              >
                <span className={`grid size-10 shrink-0 place-items-center rounded-full ${iconCls}`}>
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">{label}</span>
                  <span className="block truncate text-sm font-medium">{value}</span>
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </main>
  );
}
