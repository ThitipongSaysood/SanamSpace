import { describe, it, expect } from "vitest";
import { themeToCssVars } from "./theme";

describe("themeToCssVars", () => {
  it("maps the venue's brand colours to CSS variables", () => {
    const vars = themeToCssVars({
      primary: "#16A34A",
      secondary: "#0EA5E9",
      accent: "#F59E0B",
      warning: "#F59E0B",
      danger: "#EF4444",
    });
    expect(vars["--brand-primary"]).toBe("#16A34A");
    expect(vars["--brand-secondary"]).toBe("#0EA5E9");
    expect(vars["--brand-accent"]).toBe("#F59E0B");
    expect(vars["--brand-warning"]).toBe("#F59E0B");
    expect(vars["--brand-danger"]).toBe("#EF4444");
  });

  it("falls back rather than emitting an empty custom property", () => {
    // Branding stored before secondary/accent existed comes back blank; an
    // empty var would blank the element that uses it.
    const vars = themeToCssVars({
      primary: "#16A34A",
      secondary: "",
      accent: "",
      warning: "#F59E0B",
      danger: "#EF4444",
    });
    expect(vars["--brand-secondary"]).toBe("#16A34A");
    expect(vars["--brand-accent"]).toBe("#F59E0B");
  });
});
