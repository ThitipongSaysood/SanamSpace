"use client";
import { useMessages } from "@/lib/i18n/context";
import { useState } from "react";

/** First meaningful character of the display name, for the fallback avatar. */
function initialOf(name?: string): string {
  return name?.replace(/^คุณ/, "").trim().charAt(0) || name?.charAt(0) || "ผ";
}

/**
 * Profile avatar: shows the user's LINE photo (avatarUrl) when available,
 * falling back to their initial when there's no photo or it fails to load.
 * Fills its parent (which supplies the circle size / background / ring), so
 * wrap it in a `place-items-center overflow-hidden rounded-full` container.
 */
export function Avatar({ src, name }: { src?: string | null; name?: string }) {
  const [failed, setFailed] = useState(false);
  const ui = useMessages("app").ui;

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name ?? ui.profileAlt}
        referrerPolicy="no-referrer"
        className="size-full rounded-full object-cover"
        onError={() => setFailed(true)}
      />
    );
  }

  return <>{initialOf(name)}</>;
}
