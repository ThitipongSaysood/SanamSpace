"use client";
import { useEffect, useRef } from "react";
import { useVenueRouter as useRouter } from "@/lib/tenant/venue-nav";
import { useMutation } from "@tanstack/react-query";
import { BellOff, BellRing, Loader2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useMessages } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";

/**
 * The landing for the "ยกเลิกรับข่าวสาร" link in a LINE broadcast.
 *
 * The link's whole job is one tap: arriving here opts the customer out
 * immediately (no confirm dialog — the decision was the tap). A resubscribe
 * button covers the mis-tap. Sits under (app), so the venue's LIFF session
 * authenticates the customer and /me/unsubscribe acts on the right person.
 */
export default function UnsubscribePage() {
  const t = useMessages("app").unsubscribe;
  const router = useRouter();
  const ran = useRef(false);

  const unsub = useMutation({ mutationFn: () => api.unsubscribe() });
  const resub = useMutation({ mutationFn: () => api.resubscribe() });

  // Opt out on arrival, exactly once.
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    unsub.mutate();
  }, [unsub]);

  const working = unsub.isPending || resub.isPending;
  const failed = unsub.isError && !resub.isSuccess;
  const resubscribed = resub.isSuccess;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      {working ? (
        <>
          <div className="grid size-24 place-items-center rounded-full bg-app">
            <Loader2 className="size-10 animate-spin text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{resub.isPending ? t.resubmitting : t.working}</p>
        </>
      ) : failed ? (
        <>
          <h1 className="text-2xl font-bold">{t.errorTitle}</h1>
          <div className="w-full max-w-xs">
            <Button
              className="h-12 w-full rounded-xl bg-brand text-base font-semibold hover:bg-brand/90"
              onClick={() => unsub.mutate()}
            >
              {t.retry}
            </Button>
          </div>
        </>
      ) : resubscribed ? (
        <>
          <div className="grid place-items-center rounded-full bg-brand/10 p-4">
            <div className="grid size-24 place-items-center rounded-full bg-brand text-white shadow-lg shadow-brand/30">
              <BellRing className="size-12" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{t.resubTitle}</h1>
            <p className="mx-auto max-w-xs text-sm text-muted-foreground">{t.resubBody}</p>
          </div>
          <div className="w-full max-w-xs">
            <Button
              variant="outline"
              className="h-12 w-full rounded-xl border-black/10 text-base font-semibold"
              onClick={() => router.push("/home")}
            >
              {t.backHome}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="grid place-items-center rounded-full bg-slate-100 p-4">
            <div className="grid size-24 place-items-center rounded-full bg-slate-400 text-white">
              <BellOff className="size-12" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{t.doneTitle}</h1>
            <p className="mx-auto max-w-xs whitespace-pre-line text-sm text-muted-foreground">{t.doneBody}</p>
          </div>
          <div className="w-full max-w-xs space-y-2">
            <Button
              className="h-12 w-full rounded-xl bg-brand text-base font-semibold hover:bg-brand/90"
              onClick={() => resub.mutate()}
            >
              {t.resubBtn}
            </Button>
            <button
              type="button"
              onClick={() => router.push("/home")}
              className="h-11 w-full rounded-xl text-base font-semibold text-brand transition hover:bg-brand/5"
            >
              {t.backHome}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
