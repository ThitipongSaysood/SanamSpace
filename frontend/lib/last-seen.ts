"use client";
import { useEffect, useState } from "react";
import type { OwnerSupportTicket } from "@/lib/types";

/**
 * Client-side "last seen" markers for the header bell and chat badges.
 *
 * The platform tracks no per-owner read state for announcements or support
 * replies, so "new since I last looked" lives in localStorage. A custom event
 * makes it reactive across components: the support page marks its key on mount
 * and the header badge — a different component tree — clears without a reload.
 */
export const LAST_SEEN_KEYS = {
  announcements: "owner:announcements:lastSeen",
  support: "owner:support:lastSeen",
} as const;

const EVT = "sanamspace:last-seen";

export function markSeen(key: string) {
  try {
    window.localStorage.setItem(key, String(Date.now()));
    window.dispatchEvent(new CustomEvent(EVT, { detail: key }));
  } catch {
    // Private mode / no storage — badges simply never persist as "seen".
  }
}

// ── Per-item "seen" map ──────────────────────────────────────────────────
// One timestamp for a whole list can't say WHICH items are new. For support
// tickets that matters: with many threads, the owner needs to see which ones
// have an unread reply, not just that "something" changed. So we keep a map of
// id → last-seen timestamp and mark each ticket when it is actually opened.

function readMap(mapKey: string): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(mapKey);
    const parsed = raw ? JSON.parse(raw) : null;
    // Guard: the key previously held a single timestamp string — ignore that
    // shape so an old value can't crash the map reader.
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function markSeenItem(mapKey: string, id: string) {
  try {
    const map = readMap(mapKey);
    map[id] = Date.now();
    window.localStorage.setItem(mapKey, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(EVT, { detail: mapKey }));
  } catch {
    // Private mode — badges just won't persist as read.
  }
}

/** Returns the id→timestamp map and a function to mark one id seen now. */
export function useSeenMap(mapKey: string): [Record<string, number>, (id: string) => void] {
  const [map, setMap] = useState<Record<string, number>>({});
  useEffect(() => {
    const read = () => setMap(readMap(mapKey));
    read();
    const onEvt = (e: Event) => {
      if ((e as CustomEvent).detail === mapKey) read();
    };
    window.addEventListener(EVT, onEvt);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(EVT, onEvt);
      window.removeEventListener("storage", read);
    };
  }, [mapKey]);
  return [map, (id: string) => markSeenItem(mapKey, id)];
}

/** True when the platform has replied more recently than the owner last opened
 * this ticket — i.e. there is something unread in it. */
export function supportTicketHasUnread(ticket: OwnerSupportTicket, seen: Record<string, number>): boolean {
  const since = seen[ticket.id] ?? 0;
  return ticket.replies.some(
    (r) => r.authorSide === "platform" && (!r.createdAt || new Date(r.createdAt).getTime() > since),
  );
}

/** Returns the stored timestamp (0 if never) and a function to mark now-seen. */
export function useLastSeen(key: string): [number, () => void] {
  const [seen, setSeen] = useState(0);
  useEffect(() => {
    const read = () => {
      try {
        const v = window.localStorage.getItem(key);
        setSeen(v ? Number(v) : 0);
      } catch {
        setSeen(0);
      }
    };
    read();
    const onEvt = (e: Event) => {
      if ((e as CustomEvent).detail === key) read();
    };
    window.addEventListener(EVT, onEvt);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(EVT, onEvt);
      window.removeEventListener("storage", read);
    };
  }, [key]);
  return [seen, () => markSeen(key)];
}
