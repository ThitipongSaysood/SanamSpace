export type SlipResult = { ok: true } | { ok: false; error: string };

const ALLOWED = ["image/jpeg", "image/png"];
const MAX_BYTES = 5 * 1024 * 1024;

export function validateSlip(file: File | null): SlipResult {
  if (!file) return { ok: false, error: "กรุณาแนบสลิป" };
  if (!ALLOWED.includes(file.type)) return { ok: false, error: "รองรับเฉพาะรูปภาพ (JPG/PNG)" };
  if (file.size > MAX_BYTES) return { ok: false, error: "ไฟล์ใหญ่เกิน 5MB" };
  return { ok: true };
}
