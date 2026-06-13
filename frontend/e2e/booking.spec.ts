import { test, expect } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

// A tiny valid 1x1 PNG, written to a temp file for the slip upload.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/x8AAAAASUVORK5CYII=",
  "base64",
);

test("customer can book a court end-to-end", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "เข้าสู่ระบบด้วย LINE" }).click();
  await expect(page.getByText(/สวัสดี/)).toBeVisible();

  // Home -> venue -> single-page booking.
  await page.getByText("Everyday Badminton").first().click();
  await page.getByRole("button", { name: "จองสนาม" }).click();

  // Everything on one page: pick court, keep default date, pick a time.
  await expect(page.getByRole("heading", { name: "เลือกคอร์ท" })).toBeVisible();
  await page.getByRole("button", { name: /Court 1/ }).click();
  await page.getByRole("button", { name: "18:00" }).click();

  // Single CTA -> payment (no more step-by-step "ต่อไป").
  await page.getByRole("button", { name: "ดำเนินการชำระเงิน" }).click();

  // Payment: โอนเงิน (อัปโหลดสลิป) is preselected; confirm to get bank details.
  await expect(page.getByText("เลือกวิธีชำระเงิน")).toBeVisible();
  await page.getByRole("button", { name: /ยืนยันการชำระเงิน/ }).click();
  await expect(page.getByText("ยอดที่ต้องชำระ")).toBeVisible();

  // Attach a slip, submit, and confirm.
  const slipPath = path.join(os.tmpdir(), `slip-${Date.now()}.png`);
  fs.writeFileSync(slipPath, PNG_1x1);
  const submit = page.getByRole("button", { name: "ส่งสลิป" });
  await expect(submit).toBeDisabled(); // disabled until a valid slip is attached
  await page.locator('input[type="file"]').setInputFiles(slipPath);
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByText(/ชำระเงินสำเร็จ/)).toBeVisible();
  await page.getByRole("button", { name: "ดูการจอง" }).click();

  // Confirmation now reflects the confirmed status and offers check-in.
  await expect(page.getByText("ยืนยันแล้ว")).toBeVisible();
  await expect(page.getByRole("button", { name: /เช็คอิน/ })).toBeVisible();

  fs.unlinkSync(slipPath);
});
