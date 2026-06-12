import { describe, it, expect } from "vitest";
import { themeToCssVars } from "./theme";

describe("themeToCssVars", () => {
  it("maps tenant theme colors to CSS variables", () => {
    const vars = themeToCssVars({ primary: "#16A34A", warning: "#F59E0B", danger: "#EF4444" });
    expect(vars["--brand-primary"]).toBe("#16A34A");
    expect(vars["--brand-warning"]).toBe("#F59E0B");
    expect(vars["--brand-danger"]).toBe("#EF4444");
  });
});
