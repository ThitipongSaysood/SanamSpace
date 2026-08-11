"use client";
import { useState } from "react";
import { SportMedia } from "@/components/media";

/**
 * Renders a venue/court photo when one is available (e.g. uploaded by the owner
 * via the owner portal), falling back to the branded SportMedia placeholder
 * when there's no image — or when the image fails to load (404/broken URL).
 */
export function VenueMedia({
  src,
  sport,
  alt,
  className = "",
}: {
  src?: string | null;
  sport: string;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt ?? "ภาพสนาม"}
        className={`object-cover ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }

  return <SportMedia sport={sport} className={className} />;
}
