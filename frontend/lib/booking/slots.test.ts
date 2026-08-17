import { describe, it, expect } from "vitest";
import { isContiguous, totalHours, calcPrice, canSelect } from "./slots";
import type { Slot } from "@/lib/types";

const slot = (start: string, end: string, status: Slot["status"] = "available"): Slot => ({ start, end, status });

describe("booking slots", () => {
  it("detects contiguous selections", () => {
    expect(isContiguous([slot("18:00", "19:00"), slot("19:00", "20:00")])).toBe(true);
    expect(isContiguous([slot("18:00", "19:00"), slot("20:00", "21:00")])).toBe(false);
  });
  it("computes total hours", () => {
    expect(totalHours([slot("18:00", "19:00"), slot("19:00", "20:00")])).toBe(2);
  });
  it("computes price = hours * pricePerHour", () => {
    expect(calcPrice([slot("18:00", "19:00"), slot("19:00", "20:00")], 200)).toBe(400);
  });
  it("charges a flash-sale hour its sale price, full price for the rest", () => {
    const onSale: Slot = { start: "14:00", end: "15:00", status: "available", onSale: true, salePrice: 160 };
    // 160 (on sale) + 200 (full) = 360, not 400.
    expect(calcPrice([onSale, slot("15:00", "16:00")], 200)).toBe(360);
  });
  it("rejects selecting a booked slot", () => {
    expect(canSelect(slot("12:00", "13:00", "booked"), [])).toBe(false);
  });
  it("rejects non-contiguous addition", () => {
    expect(canSelect(slot("21:00", "22:00"), [slot("18:00", "19:00")])).toBe(false);
  });
  it("allows contiguous available addition", () => {
    expect(canSelect(slot("19:00", "20:00"), [slot("18:00", "19:00")])).toBe(true);
  });
});
