"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Hourglass, Package as PackageIcon } from "lucide-react";
import { api } from "@/lib/api/client";
import { AppHeader } from "@/components/app-header";
import { usePackages } from "@/lib/api/queries";
import { useMessages } from "@/lib/i18n/context";
import { fmt } from "@/lib/i18n/format";
import { PromptPayQR } from "@/components/promptpay-qr";
import { SlipUploader } from "@/components/slip-uploader";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import type { PackagePurchaseInstructions, VenuePackage } from "@/lib/types";

export default function PackagesPage() {
  const { data: packages, isLoading, isError, refetch } = usePackages();
  const myPackages = useQuery({ queryKey: ["my-packages"], queryFn: api.getMyPackages });
  const t = useMessages("app").packages;
  const [buying, setBuying] = useState<VenuePackage | null>(null);

  return (
    <main className="pb-6">
      <AppHeader title={t.title} />

      {/* My packages */}
      {(myPackages.data?.length ?? 0) > 0 && (
        <section className="space-y-2 px-4 pt-4">
          <h2 className="font-semibold">{t.mine}</h2>
          {myPackages.data!.map((mp) => {
            const pending = mp.status === "pending" || mp.status === "pending_review";
            return (
              <div key={mp.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                  <PackageIcon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{mp.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {pending ? (
                      <span className="text-amber-600">{t.pendingApproval}</span>
                    ) : (
                      <>{fmt(t.remainingHrs, { h: mp.remainingHours })}{mp.expiresAt ? ` · ${fmt(t.validUntil, { date: mp.expiresAt })}` : ""}</>
                    )}
                  </div>
                </div>
                {!pending && (
                  <span className="text-lg font-bold text-brand">
                    {mp.remainingHours}
                    <span className="text-xs font-normal text-muted-foreground"> {t.hoursUnit}</span>
                  </span>
                )}
              </div>
            );
          })}
        </section>
      )}

      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !packages || packages.length === 0 ? (
        <EmptyState message={t.empty} />
      ) : (
        <div className="space-y-3 p-4">
          <h2 className="font-semibold">{t.buyable}</h2>
          {packages.map((p) => (
            <div key={p.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold">{p.name}</div>
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-600">
                  {fmt(t.savePercent, { p: p.savePercent })}
                </span>
              </div>
              <div className="mt-1 text-2xl font-bold text-brand">฿{p.price.toLocaleString()}</div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">{fmt(t.validDays, { d: p.validDays })}</div>
                <button
                  type="button"
                  onClick={() => setBuying(p)}
                  className="rounded-full bg-brand px-5 py-1.5 text-sm font-semibold text-brand-foreground transition active:scale-[0.98]"
                >
                  {t.buyNow}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {buying && <PurchaseFlow pkg={buying} onClose={() => setBuying(null)} />}
    </main>
  );
}

function PurchaseFlow({ pkg, onClose }: { pkg: VenuePackage; onClose: () => void }) {
  const qc = useQueryClient();
  const [instructions, setInstructions] = useState<PackagePurchaseInstructions | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [step, setStep] = useState<"confirm" | "pay" | "done">("confirm");
  const [busy, setBusy] = useState(false);
  const t = useMessages("app").packages;

  async function start() {
    setBusy(true);
    try {
      setInstructions(await api.purchasePackage(pkg.id));
      setStep("pay");
    } finally {
      setBusy(false);
    }
  }
  async function submitSlip() {
    if (!instructions || !slipFile) return;
    setBusy(true);
    try {
      await api.purchasePackageSlip(instructions.purchaseId, slipFile);
      await qc.invalidateQueries({ queryKey: ["my-packages"] });
      setStep("done");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {step === "confirm" && (
          <>
            <h2 className="text-lg font-bold">{t.buyTitle}</h2>
            <div className="mt-3 rounded-xl bg-app/60 p-4">
              <div className="font-semibold">{pkg.name}</div>
              <div className="text-sm text-muted-foreground">{fmt(t.validDays, { d: pkg.validDays })}</div>
              <div className="mt-1 text-2xl font-bold text-brand">฿{pkg.price.toLocaleString()}</div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={onClose}>{t.cancel}</Button>
              <Button className="h-11 flex-1 rounded-xl bg-brand font-semibold hover:bg-brand/90" disabled={busy} onClick={start}>
                {busy ? t.processing : t.pay}
              </Button>
            </div>
          </>
        )}

        {step === "pay" && instructions && (
          <>
            <h2 className="text-lg font-bold">{fmt(t.payAmount, { n: instructions.amount.toLocaleString() })}</h2>
            {instructions.promptpay ? (
              <div className="mt-3 text-center">
                <PromptPayQR payload={instructions.promptpay.payload} size={190} />
                <p className="mt-2 text-xs text-muted-foreground">{t.scanBankApp}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{t.transferBankBelow}</p>
            )}
            {instructions.bank && (
              <dl className="mt-3 space-y-1.5 rounded-xl bg-app/60 p-3 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">{t.bankName}</dt><dd className="font-medium">{instructions.bank.bankName ?? "-"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">{t.accountNo}</dt><dd className="font-semibold tabular-nums">{instructions.bank.accountNumber ?? "-"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">{t.accountName}</dt><dd className="font-medium">{instructions.bank.accountName ?? "-"}</dd></div>
              </dl>
            )}
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">{t.attachSlip}</p>
              <SlipUploader onValid={setSlipFile} />
            </div>
            <Button className="mt-3 h-11 w-full rounded-xl bg-brand font-semibold hover:bg-brand/90" disabled={busy || !slipFile} onClick={submitSlip}>
              {busy ? t.sending : t.sendSlip}
            </Button>
          </>
        )}

        {step === "done" && (
          <div className="py-4 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-amber-100 text-amber-600">
              <Hourglass className="size-8" />
            </div>
            <p className="mt-4 font-semibold">{t.sentTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.sentSub}</p>
            <Button className="mt-4 h-11 w-full rounded-xl bg-brand font-semibold hover:bg-brand/90" onClick={onClose}>{t.done}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
