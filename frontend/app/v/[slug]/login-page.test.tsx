import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import type { OrgPublic } from "@/lib/types";

/**
 * The venue's front door.
 *
 * /v/{slug} is the one screen a person sees before they are anybody's customer,
 * and until now every venue's looked identical below the logo: the same
 * sentence, the same flat background, and a shuttlecock standing in for any
 * venue without a logo. What is asserted here is that the venue's own values
 * reach the screen, and — just as important — that a venue which has set
 * NOTHING still gets something of its own rather than platform copy.
 */
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useParams: () => ({ slug: "everyday-badminton" }),
}));

// The page reads route params via React `use(params)`; in jsdom the suspended
// promise never flushes, so unwrap the resolved value synchronously.
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>();
  type Resolved<T> = Promise<T> & { __value?: T };
  return {
    ...actual,
    use: <T,>(v: T) => {
      const maybe = v as Resolved<unknown>;
      if (maybe && typeof (maybe as Promise<unknown>).then === "function") return maybe.__value as T;
      return actual.use(v as never);
    },
  };
});

import VenueLoginPage from "./page";

const BASE: OrgPublic = {
  slug: "tsr", name: "สนามแบดมินตัน TSR", logoText: "TSR", logoUrl: null, coverUrl: null, tagline: null,
  liffId: null, sport: "badminton", lineOaUrl: null, phone: null,
  theme: { primary: "#2563EB", secondary: "#2563EB", accent: "#F59E0B", warning: "#F59E0B", danger: "#EF4444" },
};

function renderLogin(org: Partial<OrgPublic> = {}) {
  vi.spyOn(api, "getOrgPublic").mockResolvedValue({ ...BASE, ...org });

  const params = Promise.resolve({ slug: "tsr" }) as Promise<{ slug: string }> & { __value: { slug: string } };
  params.__value = { slug: "tsr" };

  return render(
    <AuthProvider>
      <VenueLoginPage params={params} />
    </AuthProvider>,
  );
}

describe("the venue's login page", () => {
  it("shows the venue's own name and its own tagline", async () => {
    renderLogin({ tagline: "จองคอร์ทกับ TSR\nว่างวันไหนดูได้เลย" });

    expect(await screen.findByText("TSR")).toBeInTheDocument();
    expect(screen.getByText(/ว่างวันไหนดูได้เลย/)).toBeInTheDocument();
  });

  /**
   * The empty state is a design, not a gap.
   *
   * A venue that has written nothing must still not get a sentence every other
   * venue on the platform shares — its name goes in the line we write for it.
   */
  it("writes a line from the venue's name when it has not written one", async () => {
    renderLogin({ tagline: null });

    expect(await screen.findByText(/สนามแบดมินตัน TSR/)).toBeInTheDocument();
  });

  it("uses the venue's photo when it has one", async () => {
    renderLogin({ coverUrl: "https://cdn.example.test/hall.jpg" });

    await waitFor(() =>
      expect(document.querySelector('img[src="https://cdn.example.test/hall.jpg"]')).toBeInTheDocument(),
    );
    // With a photo there is no drawn court — the venue's own picture replaces it.
    expect(document.querySelectorAll("svg polyline").length).toBe(0);
  });

  it("draws its sport's court when it has no photo", async () => {
    renderLogin({ coverUrl: null, sport: "badminton" });

    await waitFor(() => expect(document.querySelectorAll("svg polyline").length).toBeGreaterThan(0));
  });

  /** A tennis club with no logo used to be met by a badminton shuttlecock. */
  it("stands in for a missing logo with the venue's own sport, not badminton", async () => {
    renderLogin({
      logoUrl: null,
      sport: "tennis",
      sportMeta: [{ key: "tennis", name: "เทนนิส", emoji: "🎾", color: "#a3e635" }],
    });

    expect(await screen.findByText("🎾")).toBeInTheDocument();
  });

  it("falls back to the venue's initials when its sport has no emoji", async () => {
    renderLogin({ logoUrl: null, logoText: "TSR", sport: "tennis", sportMeta: [] });

    // "TS" — the venue's own letters, never another venue's sport.
    expect(await screen.findByText("TS")).toBeInTheDocument();
  });

  it("offers LINE sign-in", async () => {
    renderLogin();

    expect(await screen.findByRole("button", { name: /LINE/ })).toBeEnabled();
  });

  it("says so plainly when the venue's link is wrong", async () => {
    vi.spyOn(api, "getOrgPublic").mockRejectedValue(new Error("404"));

    const params = Promise.resolve({ slug: "nope" }) as Promise<{ slug: string }> & { __value: { slug: string } };
    params.__value = { slug: "nope" };

    render(
      <AuthProvider>
        <VenueLoginPage params={params} />
      </AuthProvider>,
    );

    expect(await screen.findByText("ไม่พบสนามนี้")).toBeInTheDocument();
  });
});
