"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import type { TenantBranding } from "@/lib/tenant/tenant-context";
import type { PublicWelcomeBanner } from "@/lib/types";

const STORAGE_KEY = "sanamspace.welcomeSeen";

/**
 * Identity of what is being shown right now.
 *
 * Dismissal is remembered against this rather than "seen once, ever": leave the
 * banners alone and a customer is never nagged again, add one or change the
 * wording and everyone sees the new set.
 */
function popupVersion(banners: PublicWelcomeBanner[], slug: string | null): string {
  return [slug, ...banners.map((b) => `${b.id}:${b.imageUrl}:${b.title}:${b.message}`)].join("|");
}

function seenKey(slug: string | null): string {
  return `${STORAGE_KEY}.${slug ?? "default"}`;
}

function readSeen(slug: string | null): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(seenKey(slug));
  } catch {
    return null;
  }
}

/** Remember that this exact set of banners has been dismissed. */
function rememberSeen(slug: string | null, version: string): void {
  try {
    window.localStorage.setItem(seenKey(slug), version);
  } catch {
    /* private mode — it will simply show again next visit */
  }
}

const NEVER_CHANGES = () => () => {};

/** The banners the venue flagged to greet arrivals with, in its own order. */
function popupBanners(tenant: TenantBranding): PublicWelcomeBanner[] {
  return tenant.welcomeBanners.filter((b) => b.popup);
}

/**
 * The venue's announcements as an entry popup.
 *
 * Only appears when the venue flagged at least one banner for it AND this
 * customer has not already dismissed this exact set. Several flagged banners
 * become one dialog paged through, not several dialogs in a row.
 */
export function WelcomePopup({ tenant }: { tenant: TenantBranding }) {
  const banners = popupBanners(tenant);
  const version = popupVersion(banners, tenant.slug);

  // Read on the client only; the server has no localStorage and rendering the
  // dialog server-side would flash it before we know it was dismissed.
  const seen = useSyncExternalStore(
    NEVER_CHANGES,
    () => readSeen(tenant.slug),
    () => version, // treat as seen during SSR so nothing flashes
  );

  const [dismissed, setDismissed] = useState(false);
  const [index, setIndex] = useState(0);
  const strip = useRef<HTMLDivElement>(null);
  const open = banners.length > 0 && seen !== version && !dismissed;

  // A dialog that leaves the page scrollable behind it feels broken on a phone.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Escape gets out, like any other dialog. Counts as a dismissal — someone who
  // pressed it has seen the announcement and does not want it again.
  const slug = tenant.slug;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setDismissed(true);
      rememberSeen(slug, version);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, slug, version]);

  function close() {
    setDismissed(true);
    rememberSeen(tenant.slug, version);
  }

  if (!open) return null;

  const current = banners[Math.min(index, banners.length - 1)];
  const isLast = index >= banners.length - 1;
  const many = banners.length > 1;

  /** Move the strip; the scroll handler is what updates `index`. */
  function goTo(i: number) {
    const el = strip.current;
    if (!el) return setIndex(i);
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={current.title ?? "ประกาศจากสนาม"}
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-5"
    >
      <button type="button" aria-label="ปิด" className="absolute inset-0" onClick={close} />

      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={close}
          aria-label="ปิด"
          className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition active:scale-95"
        >
          <X className="size-5" />
        </button>

        {/* Swipeable strip. Scroll-snap rather than a drag library: it is the
            gesture the phone already knows, keeps momentum and rubber-banding,
            and still works with a trackpad or a dot tap.
            overscroll-x-contain stops a swipe past the last one from triggering
            the browser's back gesture. */}
        <div
          ref={strip}
          onScroll={(e) => {
            const el = e.currentTarget;
            const next = Math.round(el.scrollLeft / el.clientWidth);
            if (next !== index) setIndex(next);
          }}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {banners.map((banner) => (
            <div key={banner.id} className="w-full shrink-0 snap-center">
              {banner.imageUrl && (
                // `object-contain` throughout: a tall poster is scaled down to
                // fit, never sliced — a venue that uploaded a 3:4 flyer gets the
                // whole flyer.
                //
                // With several slides the image area is a FIXED height so every
                // slide is the same size. The strip is as tall as its tallest
                // slide, so mixing a portrait poster with a landscape photo
                // otherwise left a dead gap under the shorter one.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={banner.imageUrl}
                  alt={banner.title ?? "แบนเนอร์ของสนาม"}
                  draggable={false}
                  className={`w-full object-contain ${many ? "h-[42vh]" : "max-h-[55vh]"}`}
                />
              )}
              {(banner.title || banner.message) && (
                <div className="space-y-2 px-5 pt-5">
                  {banner.title && <h2 className="text-lg font-bold">{banner.title}</h2>}
                  {banner.message && (
                    <p className="whitespace-pre-line text-sm text-muted-foreground">{banner.message}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Outside the strip, so the button does not slide out from under a
            thumb mid-swipe. */}
        <div className="space-y-3 p-5">
          {current.link ? (
            <a
              href={current.link}
              target="_blank"
              rel="noreferrer"
              onClick={() => (isLast ? close() : goTo(index + 1))}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-brand text-base font-semibold text-brand-foreground transition active:scale-[0.99]"
            >
              ดูรายละเอียด
            </a>
          ) : (
            <button
              type="button"
              onClick={() => (isLast ? close() : goTo(index + 1))}
              className="h-12 w-full rounded-xl bg-brand text-base font-semibold text-brand-foreground transition active:scale-[0.99]"
            >
              {isLast ? "เริ่มใช้งาน" : "ถัดไป"}
            </button>
          )}

          {/* Only when there is actually more than one to page through. */}
          {many && (
            <div className="flex items-center justify-center gap-1.5">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`ประกาศที่ ${i + 1}`}
                  aria-current={i === index}
                  className={
                    i === index
                      ? "h-1.5 w-5 rounded-full bg-brand transition-all"
                      : "size-1.5 rounded-full bg-black/15 transition-all"
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
