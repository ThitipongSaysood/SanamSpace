"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Hourglass } from "lucide-react";
import { api } from "@/lib/api/client";
import { AppHeader } from "@/components/app-header";
import { useCredit } from "@/lib/api/queries";
import { useMessages } from "@/lib/i18n/context";
import { PromptPayQR } from "@/components/promptpay-qr";
import { SlipUploader } from "@/components/slip-uploader";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WalletTopupInstructions } from "@/lib/types";

const PRESETS = [100, 300, 500, 1000];

export default function CreditPage() {
  const qc = useQueryClient();
  const { data: wallet, isLoading, isError, refetch } = useCredit();
  const cr = useMessages("app").credit;

  // top-up flow: idle → amount → pay (QR + slip) → done
  const [step, setStep] = useState<"idle" | "amount" | "pay" | "done">("idle");
  const [amount, setAmount] = useState("");
  const [instructions, setInstructions] = useState<WalletTopupInstructions | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function startTopup() {
    const value = Number(amount);
    if (!value || value <= 0) return;
    setBusy(true);
    try {
      setInstructions(await api.walletTopup(value));
      setStep("pay");
    } finally {
      setBusy(false);
    }
  }
  async function submitSlip() {
    if (!instructions || !slipFile) return;
    setBusy(true);
    try {
      await api.walletTopupSlip(instructions.transactionId, slipFile);
      await qc.invalidateQueries({ queryKey: ["wallet"] });
      setStep("done");
    } finally {
      setBusy(false);
    }
  }
  function reset() {
    setStep("idle");
    setAmount("");
    setInstructions(null);
    setSlipFile(null);
  }

  return (
    <main className="pb-6">
      <AppHeader title={cr.title} />
      {isLoading ? (
        <Loading />
      ) : isError || !wallet ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="space-y-4 p-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground">{cr.balance}</div>
                <div className="mt-1 text-3xl font-bold text-brand">฿{wallet.balance.toLocaleString()}</div>
              </div>
              {step === "idle" && (
                <button
                  type="button"
                  onClick={() => setStep("amount")}
                  className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground transition active:scale-[0.98]"
                >
                  {cr.topup}
                </button>
              )}
            </div>
          </div>

          {/* Step: choose amount */}
          {step === "amount" && (
            <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <p className="font-semibold">{cr.topupTitle}</p>
              <div className="grid grid-cols-4 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(String(p))}
                    className={`rounded-lg border py-2 text-sm font-medium transition ${
                      amount === String(p) ? "border-brand bg-brand/5 text-brand" : "border-input hover:bg-app"
                    }`}
                  >
                    ฿{p}
                  </button>
                ))}
              </div>
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={cr.enterAmount}
              />
              <div className="flex gap-2">
                <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={reset}>
                  {cr.cancel}
                </Button>
                <Button
                  className="h-11 flex-1 rounded-xl bg-brand font-semibold hover:bg-brand/90"
                  disabled={busy || !Number(amount)}
                  onClick={startTopup}
                >
                  {busy ? cr.processing : cr.next}
                </Button>
              </div>
            </div>
          )}

          {/* Step: pay (QR + bank) then upload slip */}
          {step === "pay" && instructions && (
            <>
              <div className="rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-black/5">
                <p className="text-sm text-muted-foreground">{cr.topupAmount}</p>
                <p className="mt-1 text-3xl font-bold text-brand">฿{instructions.amount.toLocaleString()}</p>
                {instructions.promptpay ? (
                  <div className="mt-3">
                    <PromptPayQR payload={instructions.promptpay.payload} size={200} />
                    <p className="mt-2 text-xs text-muted-foreground">{cr.scanBankApp}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">{cr.transferBankBelow}</p>
                )}
              </div>

              {instructions.bank && (
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                  <p className="font-semibold">{cr.bankTransfer}</p>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between"><dt className="text-muted-foreground">{cr.bankName}</dt><dd className="font-medium">{instructions.bank.bankName ?? "-"}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">{cr.accountNo}</dt><dd className="font-semibold tabular-nums">{instructions.bank.accountNumber ?? "-"}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">{cr.accountName}</dt><dd className="font-medium">{instructions.bank.accountName ?? "-"}</dd></div>
                  </dl>
                </div>
              )}

              <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <p className="text-sm font-medium">{cr.transferThenAttach}</p>
                <SlipUploader onValid={setSlipFile} />
                <Button
                  className="h-11 w-full rounded-xl bg-brand font-semibold hover:bg-brand/90"
                  disabled={busy || !slipFile}
                  onClick={submitSlip}
                >
                  {busy ? cr.sending : cr.sendSlip}
                </Button>
              </div>
            </>
          )}

          {/* Step: done */}
          {step === "done" && (
            <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-amber-100 text-amber-600">
                <Hourglass className="size-8" />
              </div>
              <p className="mt-4 font-semibold">{cr.sentTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{cr.sentSub}</p>
              <Button className="mt-4 h-11 w-full rounded-xl bg-brand font-semibold hover:bg-brand/90" onClick={reset}>
                {cr.done}
              </Button>
            </div>
          )}

          {step === "idle" && (
            <section>
              <h2 className="mb-2.5 font-semibold">{cr.recent}</h2>
              {wallet.transactions.length === 0 ? (
                <EmptyState message={cr.noTransactions} />
              ) : (
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                  {wallet.transactions.map((t, i) => {
                    const pending = t.status === "pending" || t.status === "pending_review";
                    return (
                      <div
                        key={t.id}
                        className={`flex items-center gap-3 px-4 py-3 ${
                          i < wallet.transactions.length - 1 ? "border-b border-black/5" : ""
                        }`}
                      >
                        <span className="w-14 shrink-0 text-xs text-muted-foreground">{t.date}</span>
                        <span className="flex-1 truncate text-sm">
                          {t.label}
                          {pending && <span className="ml-1.5 text-xs text-amber-600">{cr.pendingApproval}</span>}
                        </span>
                        <span className={`text-sm font-semibold ${pending ? "text-amber-600" : t.amount > 0 ? "text-brand" : "text-foreground"}`}>
                          {t.amount > 0 ? "+" : "−"}฿{Math.abs(t.amount).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </main>
  );
}
