import { tenant } from "@/config/tenant";

/** Brand mark: green shuttlecock badge + two-line wordmark (EVERYDAY / BADMINTON). */
export function BrandLogo() {
  const [first, ...rest] = tenant.logoText.split(" ");
  return (
    <div className="flex items-center gap-2">
      <div className="grid size-9 place-items-center rounded-xl bg-brand text-lg leading-none shadow-sm" aria-hidden>
        🏸
      </div>
      <div className="leading-tight">
        <div className="text-sm font-extrabold tracking-tight text-foreground">{first}</div>
        {rest.length > 0 && (
          <div className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
            {rest.join(" ")}
          </div>
        )}
      </div>
    </div>
  );
}
