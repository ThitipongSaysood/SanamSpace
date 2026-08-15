import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CourtBackdrop } from "@/components/court-backdrop";

/**
 * The backdrop must be the venue's OWN sport.
 *
 * This is the same failure the sport loader and the toast icon each had before
 * it: a hard-coded badminton default meant a tennis club, a football pitch and
 * a basketball court all opened on someone else's markings. So what is asserted
 * here is difference — that two sports do not draw the same thing — rather than
 * any particular set of lines, which is a design decision and free to change.
 */
function markings(container: HTMLElement) {
  return Array.from(container.querySelectorAll("polyline"))
    .map((el) => el.getAttribute("points"))
    .join("|");
}

describe("the court behind the venue's login page", () => {
  it("draws a different court for a different sport", () => {
    const badminton = render(<CourtBackdrop sport="badminton" color="#16A34A" />);
    const football = render(<CourtBackdrop sport="football" color="#16A34A" />);

    expect(markings(badminton.container)).not.toBe(markings(football.container));
  });

  it("puts a net on the sports that have one, and none on the sports that do not", () => {
    // The net is the only thing standing off the floor plane — a polygon.
    const withNet = render(<CourtBackdrop sport="volleyball" color="#16A34A" />);
    const withoutNet = render(<CourtBackdrop sport="basketball" color="#16A34A" />);

    expect(withNet.container.querySelectorAll("polygon").length).toBeGreaterThan(
      withoutNet.container.querySelectorAll("polygon").length,
    );
  });

  it("treats the catalogue's aliases as the sport they mean", () => {
    // `soccer` and `pingpong` are stored on real branches; the catalogue folds
    // them into football and tabletennis rather than keeping two rows.
    const soccer = render(<CourtBackdrop sport="soccer" color="#16A34A" />);
    const football = render(<CourtBackdrop sport="football" color="#16A34A" />);

    expect(markings(soccer.container)).toBe(markings(football.container));
  });

  it("draws sports that share a court identically", () => {
    // Pickleball is played on lines a tennis player recognises.
    const pickleball = render(<CourtBackdrop sport="pickleball" color="#16A34A" />);
    const tennis = render(<CourtBackdrop sport="tennis" color="#16A34A" />);

    expect(markings(pickleball.container)).toBe(markings(tennis.container));
  });

  it("still draws something for a sport nobody has told it about", () => {
    // A venue can store any key it typed months ago. Drawing nothing would
    // leave the login page half-empty; drawing badminton would be a guess.
    const { container } = render(<CourtBackdrop sport="underwater-hockey" color="#16A34A" />);

    expect(container.querySelectorAll("polyline").length).toBeGreaterThan(0);
  });

  it("draws a court when the venue has no sport at all", () => {
    const { container } = render(<CourtBackdrop sport={null} color="#16A34A" />);

    expect(container.querySelectorAll("polyline").length).toBeGreaterThan(0);
  });

  it("takes the venue's colour", () => {
    const { container } = render(<CourtBackdrop sport="badminton" color="#7C3AED" />);

    expect(container.innerHTML).toContain("#7C3AED");
  });

  it("is hidden from screen readers — it says nothing a customer needs read out", () => {
    const { container } = render(<CourtBackdrop sport="badminton" color="#16A34A" />);

    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });
});
