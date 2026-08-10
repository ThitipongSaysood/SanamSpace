import { toast as sonner } from "sonner";
import { AppToast, type ToastKind } from "@/components/app-toast";

/**
 * App-wide toast: a venue-branded card (accent bar + sport icon + title +
 * message + close) rendered via sonner's toast.custom. Every `toast.success` /
 * `toast.error` in the app funnels through here, so the look is consistent and
 * changes in one place.
 */

const SPORT_EMOJI: Record<string, string> = {
  badminton: "🏸",
  tennis: "🎾",
  pickleball: "🎾",
  squash: "🎾",
  futsal: "⚽",
  football: "⚽",
  soccer: "⚽",
  basketball: "🏀",
  volleyball: "🏐",
  takraw: "🏐",
  tabletennis: "🏓",
  pingpong: "🏓",
};

// The venue's sport, set by the tenant context on load. Module-level so a plain
// (non-React) toast call can reach it.
let sportEmoji = "🏸";
export function setToastSport(sport?: string | null) {
  sportEmoji = (sport && SPORT_EMOJI[sport.toLowerCase()]) || "🏸";
}

const DURATION: Record<ToastKind, number> = {
  success: 3500,
  info: 3500,
  warning: 5000,
  error: 6000,
  loading: Infinity,
};

type Opts = { title?: string; id?: string | number; duration?: number };

function show(kind: ToastKind, message?: string, opts: Opts = {}): string | number {
  return sonner.custom(
    (id) => (
      <AppToast
        kind={kind}
        title={opts.title}
        message={message}
        sportEmoji={sportEmoji}
        onClose={() => sonner.dismiss(id)}
      />
    ),
    { id: opts.id, duration: opts.duration ?? DURATION[kind] },
  );
}

export const toast = {
  success: (message?: string, opts?: Opts) => show("success", message, opts),
  error: (message?: string, opts?: Opts) => show("error", message, opts),
  warning: (message?: string, opts?: Opts) => show("warning", message, opts),
  info: (message?: string, opts?: Opts) => show("info", message, opts),
  message: (message?: string, opts?: Opts) => show("info", message, opts),
  loading: (message?: string, opts?: Opts) => show("loading", message, opts),
  dismiss: (id?: string | number) => sonner.dismiss(id),
};

/**
 * Wrap a save/mutation promise so the user always sees the outcome: a "saving…"
 * toast that becomes a success or the real error. Returns the same promise so
 * `useMutation` still gets the result.
 */
export function toastSave<T>(
  promise: Promise<T>,
  msg?: { loading?: string; success?: string },
): Promise<T> {
  // A custom toast can't be reliably swapped in place by id, so dismiss the
  // "saving…" toast outright the moment the promise settles, then show the
  // result as its own toast — otherwise the loading toast (duration: Infinity)
  // hangs forever next to the success one.
  const id = toast.loading(msg?.loading ?? "กำลังบันทึก...");
  promise.then(
    () => {
      toast.dismiss(id);
      toast.success(msg?.success ?? "บันทึกแล้ว");
    },
    (e) => {
      toast.dismiss(id);
      toast.error(e instanceof Error && e.message ? e.message : "ไม่สำเร็จ กรุณาลองใหม่");
    },
  );
  return promise;
}
