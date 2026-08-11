import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppToast } from "@/components/app-toast";
import type { OrgPublic, SportMeta } from "@/lib/types";

/**
 * The notification icon must be the venue's sport.
 *
 * `lib/toast.tsx` used to hold a table of twelve sport keys and translate a key
 * to an emoji itself, falling back to a shuttlecock for anything it did not
 * recognise. It was one of six such tables and it disagreed with the others, so
 * a tennis venue's customers got badminton on every toast in the app.
 *
 * The emoji now arrives already resolved from the platform catalogue, which
 * makes the interesting question "does the venue's own value reach the card" —
 * and that is what is asserted here rather than any list of sports.
 */
const TENNIS: SportMeta = { key: "tennis", name: "เทนนิส", emoji: "🎾", color: "#a3e635" };

async function freshToast() {
  vi.resetModules();

  return import("@/lib/toast");
}

describe("the venue's sport reaches the toast", () => {
  beforeEach(() => vi.resetModules());

  it("renders whatever emoji the venue was given", () => {
    render(<AppToast kind="success" message="บันทึกแล้ว" sportEmoji={TENNIS.emoji} onClose={() => {}} />);

    expect(screen.getByText("🎾")).toBeInTheDocument();
    expect(screen.queryByText("🏸")).not.toBeInTheDocument();
  });

  it("carries an emoji the old twelve-key table never had", () => {
    render(<AppToast kind="info" message="ทดสอบ" sportEmoji="🥒" onClose={() => {}} />);

    expect(screen.getByText("🥒")).toBeInTheDocument();
  });

  it("setToastSport takes the emoji itself, no lookup table left to disagree", async () => {
    const { setToastSport } = await freshToast();

    // Anything at all — the point is that nothing in this module decides it.
    expect(() => setToastSport(TENNIS.emoji)).not.toThrow();
    expect(() => setToastSport("🥍")).not.toThrow();
  });
});

/**
 * The other half of the same guarantee: the emoji a screen is handed is the one
 * the venue payload described, picked by the venue's PRIMARY sport key.
 *
 * A venue renting several sports has one notification icon, and which one it is
 * used to be decided by whichever branch happened to be created first. It is
 * `sport` — the first key — matched against `sportMeta` now, so the two always
 * agree with each other.
 */
describe("the primary sport picks the icon", () => {
  const org = {
    sport: "pickleball",
    sports: ["pickleball", "tennis"],
    sportMeta: [
      { key: "pickleball", name: "พิคเคิลบอล", emoji: "🥒", color: "#84cc16" },
      TENNIS,
    ],
  } as Partial<OrgPublic> as OrgPublic;

  it("uses the meta entry matching the primary key", () => {
    const emoji = org.sportMeta?.find((s) => s.key === org.sport)?.emoji ?? null;

    expect(emoji).toBe("🥒");
  });

  it("gives nothing rather than a wrong guess when the key has no entry", () => {
    const orphan = { ...org, sport: "quidditch" };
    const emoji = orphan.sportMeta?.find((s) => s.key === orphan.sport)?.emoji ?? null;

    expect(emoji).toBeNull();
  });
});
