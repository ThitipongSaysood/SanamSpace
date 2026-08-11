"use client";
import { useEffect, useState } from "react";

/**
 * Seconds left until an ISO deadline, ticking once a second, plus a `done` flag
 * and an "M:SS" label. Used by the pay-by countdown on unpaid holds.
 *
 * A null/absent deadline (nothing to wait for) reports done with no time left,
 * so callers can render the same "no live hold" branch either way.
 */
export function useCountdown(deadline?: string | null): {
  secondsLeft: number;
  done: boolean;
  label: string;
} {
  const target = deadline ? new Date(deadline).getTime() : 0;

  const [secondsLeft, setSecondsLeft] = useState(() =>
    target ? Math.max(0, Math.round((target - Date.now()) / 1000)) : 0,
  );

  useEffect(() => {
    if (!target) return;
    const tick = () => {
      const left = Math.max(0, Math.round((target - Date.now()) / 1000));
      setSecondsLeft(left);
      return left;
    };
    tick();
    const id = setInterval(() => {
      if (tick() <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [target]);

  // With no deadline there is nothing to wait for — report zero without leaning
  // on stale state, so a hold that clears (expiresAt → null) reads as done.
  const left = target ? secondsLeft : 0;
  const m = Math.floor(left / 60);
  const s = left % 60;

  return {
    secondsLeft: left,
    done: !deadline || left <= 0,
    label: `${m}:${s.toString().padStart(2, "0")}`,
  };
}
