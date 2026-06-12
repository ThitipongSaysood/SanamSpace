import { describe, it, expect } from "vitest";
import { validateSlip } from "./slip";

const file = (type: string, sizeMB: number) => ({ type, size: sizeMB * 1024 * 1024 }) as File;

describe("validateSlip", () => {
  it("accepts a jpg under 5MB", () => {
    expect(validateSlip(file("image/jpeg", 2))).toEqual({ ok: true });
  });
  it("rejects non-image", () => {
    expect(validateSlip(file("application/pdf", 1))).toEqual({ ok: false, error: "รองรับเฉพาะรูปภาพ (JPG/PNG)" });
  });
  it("rejects > 5MB", () => {
    expect(validateSlip(file("image/png", 6))).toEqual({ ok: false, error: "ไฟล์ใหญ่เกิน 5MB" });
  });
  it("rejects when no file", () => {
    expect(validateSlip(null)).toEqual({ ok: false, error: "กรุณาแนบสลิป" });
  });
});
