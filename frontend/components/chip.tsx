import { Car, ShowerHead, Coffee, Wifi, Wind, Lock, Dumbbell, CheckCircle2 } from "lucide-react";
import type { ComponentType } from "react";

type Meta = { icon: ComponentType<{ className?: string }>; label: string };

const facilityMeta: Record<string, Meta> = {
  parking: { icon: Car, label: "ที่จอดรถ" },
  shower: { icon: ShowerHead, label: "ห้องอาบน้ำ" },
  cafe: { icon: Coffee, label: "คาเฟ่" },
  wifi: { icon: Wifi, label: "WiFi" },
  aircon: { icon: Wind, label: "เครื่องปรับอากาศ" },
  locker: { icon: Lock, label: "ล็อกเกอร์" },
  equipment: { icon: Dumbbell, label: "ร้านอุปกรณ์" },
};

export function FacilityChip({ name }: { name: string }) {
  const m = facilityMeta[name] ?? { icon: CheckCircle2, label: name };
  const Icon = m.icon;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand">
      <Icon className="size-3.5" />
      {m.label}
    </span>
  );
}
