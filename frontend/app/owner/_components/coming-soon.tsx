import type { LucideIcon } from "lucide-react";

/** Polished placeholder for owner sections whose backend isn't built yet. */
export function ComingSoon({
  title,
  subtitle,
  description,
  Icon,
}: {
  title: string;
  subtitle: string;
  description: string;
  Icon: LucideIcon;
}) {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </header>
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-black/5">
        <span className="grid size-16 place-items-center rounded-2xl bg-brand/10 text-brand">
          <Icon className="size-8" />
        </span>
        <div className="text-lg font-semibold">เร็วๆ นี้</div>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
