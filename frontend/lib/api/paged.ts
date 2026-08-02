/**
 * Paged list access.
 *
 * The list endpoints that grow without limit (bookings, customers, payments,
 * invoices, transactions) now return one page at a time, so a screen that wants
 * the older rows has to ask for them. Without this the UI would silently show
 * only the newest page and look like data had gone missing.
 */
export type Page<T> = {
  items: T[];
  /** Total rows across all pages, for "แสดง X จาก Y". */
  total: number;
  hasMore: boolean;
};

type Envelope<T> = {
  data: T[];
  meta?: { current_page?: number; last_page?: number; total?: number };
};

export function toPage<T>(envelope: Envelope<T>): Page<T> {
  const meta = envelope.meta ?? {};
  const current = meta.current_page ?? 1;
  const last = meta.last_page ?? 1;

  return {
    items: envelope.data ?? [],
    total: meta.total ?? envelope.data?.length ?? 0,
    hasMore: current < last,
  };
}

/** Append a page to what is already on screen, ignoring rows already seen. */
export function appendPage<T extends { id: string }>(existing: T[], next: T[]): T[] {
  const seen = new Set(existing.map((x) => x.id));
  return [...existing, ...next.filter((x) => !seen.has(x.id))];
}

export function withPage(path: string, page: number, perPage?: number): string {
  const qs = new URLSearchParams(path.includes("?") ? path.split("?")[1] : "");
  qs.set("page", String(page));
  if (perPage) qs.set("perPage", String(perPage));
  return `${path.split("?")[0]}?${qs.toString()}`;
}
