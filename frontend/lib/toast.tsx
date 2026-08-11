import { toast as sonner } from "sonner";
import { AppToast, type ToastKind } from "@/components/app-toast";

/**
 * App-wide toast: a venue-branded card (accent bar + sport icon + title +
 * message + close) rendered via sonner's toast.custom. Every `toast.success` /
 * `toast.error` in the app funnels through here, so the look is consistent and
 * changes in one place.
 */

// The venue's sport icon, set by the tenant context on load. Module-level so a
// plain (non-React) toast call can reach it.
//
// This file used to hold its own table of twelve sport keys and translate here.
// It was one of six such tables, no two of them agreeing, and anything it did
// not recognise silently became a shuttlecock — a tennis venue's customers were
// shown badminton on every toast. The emoji arrives already resolved from the
// platform catalogue now; the shuttlecock remains only as the icon for "no
// venue", which is the owner and admin portals.
const NO_VENUE = "🏸";
let sportEmoji = NO_VENUE;
export function setToastSport(emoji?: string | null) {
  sportEmoji = emoji || NO_VENUE;
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
  // Delayed spinner. A fast save (our endpoints answer in ~15ms) resolves before
  // sonner has even mounted a loading toast — so dismissing it in .then() races
  // the mount, the dismiss is lost, and the loading card (duration: Infinity)
  // hangs forever next to the result. The button already shows "saving…", so the
  // toast is only worth showing when the save is genuinely slow: arm it after a
  // short delay, and cancel that timer if the promise settles first. When it
  // does fire, the toast is fully mounted by the time we dismiss it, so the
  // dismiss sticks. An explicit id + finite duration are extra insurance.
  const id = `save-${(saveSeq = (saveSeq + 1) % 1e9)}`;
  let shown = false;
  const timer = setTimeout(() => {
    shown = true;
    toast.loading(msg?.loading ?? "กำลังบันทึก...", { id, duration: 20_000 });
  }, 400);
  const settle = () => {
    clearTimeout(timer);
    if (shown) toast.dismiss(id);
  };
  promise.then(
    () => {
      settle();
      toast.success(msg?.success ?? "บันทึกแล้ว");
    },
    (e) => {
      settle();
      toast.error(e instanceof Error && e.message ? e.message : "ไม่สำเร็จ กรุณาลองใหม่");
    },
  );
  return promise;
}

// Monotonic counter for unique, explicit loading-toast ids (see toastSave).
let saveSeq = 0;
