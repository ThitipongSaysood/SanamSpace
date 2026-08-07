"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Copy, ExternalLink, Link2 } from "lucide-react";

/** The public URL a venue hands to its customers: {origin}/v/{slug}. */
export function customerLinkFor(slug: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/v/${encodeURIComponent(slug)}`;
}

// The origin cannot change while the page is mounted, so there is nothing to
// subscribe to.
const NEVER_CHANGES = () => () => {};

/**
 * The page's origin — read without an effect, so no extra render pass and no
 * hydration mismatch (the server snapshot is empty, the client fills it in).
 * Links must be built from the live origin: it differs between local and prod.
 */
export function useOrigin(): string {
  return useSyncExternalStore(
    NEVER_CHANGES,
    () => window.location.origin,
    () => "",
  );
}

/**
 * The one link a venue gives its customers, ready to copy.
 *
 * Shown to both the venue owner and the platform admin, so it lives in
 * components/ rather than in either portal. Rendered client-side only: the URL
 * depends on window.location.origin, which differs between local and prod, and
 * hard-coding it would hand out a broken link.
 */
export function CustomerLink({
  slug,
  title = "ลิงก์สำหรับลูกค้า",
  hint = "ส่งลิงก์นี้ให้ลูกค้าเพื่อเข้าหน้าจองของสนาม — ลูกค้าจะเห็นเฉพาะสนามนี้เท่านั้น",
  className = "",
}: {
  slug: string | null | undefined;
  title?: string;
  hint?: string;
  className?: string;
}) {
  const origin = useOrigin();
  const [copied, setCopied] = useState(false);

  const url = slug && origin ? customerLinkFor(slug, origin) : null;

  // Clear the "copied" confirmation after a moment.
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard is blocked outside a secure context (plain http on a LAN
      // address) — select the text so it can still be copied by hand.
      const el = document.getElementById("customer-link-url");
      if (el) window.getSelection()?.selectAllChildren(el);
    }
  }

  if (!slug) return null;

  return (
    <section
      className={`space-y-2.5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 ${className}`}
    >
      <div>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Link2 className="size-4 text-brand" /> {title}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>

      {/* The URL takes its own row and wraps instead of truncating — this card
          also renders inside the narrow admin drawer, where a clipped link is
          useless to whoever needs to read or retype it. */}
      <code
        id="customer-link-url"
        className="block break-all rounded-lg bg-app px-3 py-2 text-xs text-brand ring-1 ring-black/5"
      >
        {url ?? " "}
      </code>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copy}
          disabled={!url}
          aria-label="คัดลอกลิงก์สำหรับลูกค้า"
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${
            copied
              ? "bg-brand/10 text-brand ring-1 ring-brand/20"
              : "bg-brand text-brand-foreground hover:bg-brand/90"
          }`}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "คัดลอกแล้ว" : "คัดลอก"}
        </button>

        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-muted-foreground ring-1 ring-black/10 transition hover:text-foreground"
          >
            <ExternalLink className="size-4" /> เปิดดู
          </a>
        )}
      </div>
    </section>
  );
}
