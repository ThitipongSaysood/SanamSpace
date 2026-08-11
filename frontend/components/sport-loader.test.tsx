import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SportLoader } from "./sport-loader";
import type { SportMeta } from "@/lib/types";

/**
 * The loading screen must show the venue's own sport.
 *
 * It used to carry a table of ten sport keys written into this file — one of
 * six such tables in the codebase, no two agreeing — and silently dropped
 * anything it did not recognise. Drop them all and it fell back to badminton,
 * so a tennis venue's customers watched a shuttlecock bounce with nothing
 * anywhere saying why. These assertions are the guarantee that the emoji on
 * screen is the one the platform catalogue holds for that venue's sport.
 */
const TENNIS: SportMeta = { key: "tennis", name: "เทนนิส", emoji: "🎾", color: "#a3e635" };
const PICKLEBALL: SportMeta = { key: "pickleball", name: "พิคเคิลบอล", emoji: "🥒", color: "#84cc16" };

describe("SportLoader", () => {
  it("shows the venue's sport, not a shuttlecock", () => {
    render(<SportLoader sports={[TENNIS]} />);

    expect(screen.getByText("เทนนิส")).toBeInTheDocument();
    expect(screen.getByText("🎾")).toBeInTheDocument();
    expect(screen.queryByText("🏸")).not.toBeInTheDocument();
  });

  it("colours the sport chip from the catalogue", () => {
    render(<SportLoader sports={[TENNIS]} />);

    expect(screen.getByText("เทนนิส")).toHaveStyle({ color: TENNIS.color });
  });

  /**
   * A sport the old hard-coded table never had, with an emoji it never had
   * either. Nothing in the app decides this any more, so a sport added in the
   * admin screen has to arrive intact — that is the entire point of the move.
   */
  it("draws a sport that no version of the old table knew", () => {
    render(<SportLoader sports={[PICKLEBALL]} />);

    expect(screen.getByText("พิคเคิลบอล")).toBeInTheDocument();
    expect(screen.getByText("🥒")).toBeInTheDocument();
  });

  it("starts on the venue's first sport when it rents several", () => {
    render(<SportLoader sports={[TENNIS, PICKLEBALL]} />);

    expect(screen.getByText("เทนนิส")).toBeInTheDocument();
  });

  /**
   * The flash this file used to produce, stated as a test.
   *
   * The venue's branding is restored from localStorage inside an effect, so the
   * FIRST render of this screen never has it — every entry into the app, for
   * every venue. A default of badminton therefore put a shuttlecock on screen
   * for a measured 125ms and then swapped it for the venue's real sport. That
   * is the same wrong guess this whole catalogue exists to remove, only faster.
   */
  it("claims no sport at all until the venue's own has arrived", () => {
    render(<SportLoader sports={[]} />);

    expect(screen.queryByText("🏸")).not.toBeInTheDocument();
    expect(screen.queryByText("แบดมินตัน")).not.toBeInTheDocument();
    // Still a loading screen, just an honest one.
    expect(screen.getByText("เตรียมสนาม")).toBeInTheDocument();
  });
});
