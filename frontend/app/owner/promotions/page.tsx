"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgePercent, Tag, Zap } from "lucide-react";
import { ownerApi } from "@/lib/api/owner";
import { PromotionsPanel } from "./_promotions-panel";
import { CouponsPanel } from "./_coupons-panel";
import { FlashSalesPanel } from "./_flash-sales-panel";
import { useMessages } from "@/lib/i18n/context";

const TABS = [
  { key: "promotions", icon: Tag },
  // Only shown when the plan includes coupons — it used to be its own sidebar
  // entry carrying `feature: "coupon"`, and folding it in here must not quietly
  // hand it to plans that never paid for it.
  { key: "coupons", icon: BadgePercent, feature: "coupon" },
  // Flash sales ride the same discount feature as coupons.
  { key: "flash", icon: Zap, feature: "coupon" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * Promotions and the coupons behind them, in one place.
 *
 * They were two sidebar entries for the two halves of one thing: the promotion
 * is the banner a customer taps, the coupon is what actually comes off the
 * price and where the conditions live. A venue writing "จอง 07:00–16:00 ลด 10%"
 * had to write the words on one screen and the rule on another, with nothing
 * showing whether the two agreed.
 */
export default function OwnerPromotionsPage() {
  const tp = useMessages("owner").promotions;
  const [tab, setTab] = useState<TabKey>("promotions");
  const { data: sub } = useQuery({ queryKey: ["owner", "subscription"], queryFn: ownerApi.getSubscription });

  // Nothing is hidden while the subscription is still loading — flashing a tab
  // and then removing it reads as a bug.
  const tabs = TABS.filter((t) => !("feature" in t) || !sub?.features || sub.features.includes(t.feature));
  const active = tabs.some((t) => t.key === tab) ? tab : "promotions";

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{tp.title}</h1>
        <p className="text-sm text-muted-foreground">{tp.subtitle}</p>
      </header>

      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-1 border-b border-black/5">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition ${
                active === t.key
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="size-4" />{" "}
              {t.key === "promotions" ? tp.tabPromotions : t.key === "coupons" ? tp.tabCoupons : tp.tabFlash}
            </button>
          ))}
        </div>
      )}

      {active === "promotions" ? (
        <PromotionsPanel />
      ) : active === "coupons" ? (
        <CouponsPanel />
      ) : (
        <FlashSalesPanel />
      )}
    </div>
  );
}
