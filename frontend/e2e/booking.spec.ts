import { test, expect } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

// A tiny valid 1x1 PNG, written to a temp file for the slip upload.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/x8AAAAASUVORK5CYII=",
  "base64",
);

// The customer app is entered through a venue's own link — there is no
// venue-less login, and every screen below stays under /v/{slug}.
const VENUE = "everyday-badminton";

test("customer can book a court end-to-end", async ({ page, request }) => {
  await page.goto(`/v/${VENUE}`);
  await page.getByRole("button", { name: "เข้าสู่ระบบด้วย LINE" }).click();
  await expect(page).toHaveURL(new RegExp(`/v/${VENUE}/home`));

  // The venue may greet arrivals with a popup; it is modal, so dismiss it
  // before touching anything underneath. Escape rather than the button: with
  // several announcements the button reads "ถัดไป" and pages instead of closing.
  const welcome = page.getByRole("dialog");
  if (await welcome.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await expect(welcome).toHaveCount(0);
  }
  // The home screen rendered. Asserted on a section heading rather than the
  // greeting, which now shows the customer's own name.
  await expect(page.getByRole("heading", { name: "การจองที่กำลังจะถึง" })).toBeVisible();

  // Home -> venue -> single-page booking. Addressed by link rather than by
  // name: the venue's display name is the owner's to change at any time.
  await page.locator('a[href*="/venue/"]').first().click();
  await page.getByRole("button", { name: "จองสนาม" }).click();

  // Everything on one page: pick court, keep default date, pick a time.
  await expect(page.getByRole("heading", { name: "เลือกคอร์ท" })).toBeVisible();
  await page.getByRole("button", { name: /Court 1/ }).click();
  // Any free slot: this test books for real, so a fixed hour would only be
  // bookable once against a persistent database.
  // Slots are labelled "HH:MM ถึง HH:MM"; unavailable ones say so and are disabled.
  await page
    .getByRole("button", { name: /^\d{2}:\d{2} ถึง \d{2}:\d{2}$/ })
    .and(page.locator("button:enabled"))
    .first()
    .click();

  // Single CTA -> payment (no more step-by-step "ต่อไป").
  await page.getByRole("button", { name: "ดำเนินการชำระเงิน" }).click();

  // Payment: PromptPay QR is preselected, so pick transfer to reach the slip
  // upload, then continue to the bank details.
  await expect(page.getByText("เลือกวิธีชำระเงิน")).toBeVisible();
  await page.getByRole("button", { name: "โอนเงิน (อัปโหลดสลิป)" }).click();
  await page.getByRole("button", { name: "ดำเนินการชำระเงิน" }).click();
  await expect(page.getByText("ยอดที่ต้องชำระ")).toBeVisible();

  // Attach a slip, submit, and confirm.
  const slipPath = path.join(os.tmpdir(), `slip-${Date.now()}.png`);
  fs.writeFileSync(slipPath, PNG_1x1);
  const submit = page.getByRole("button", { name: "ส่งสลิป" });
  await expect(submit).toBeDisabled(); // disabled until a valid slip is attached
  await page.locator('input[type="file"]').setInputFiles(slipPath);
  await expect(submit).toBeEnabled();
  await submit.click();

  // A transferred slip is not an instant confirmation — the venue verifies it,
  // so the customer lands on "waiting for review", still inside their venue.
  await expect(page.getByRole("heading", { name: "ส่งสลิปแล้ว" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/v/${VENUE}/payment/`));
  await page.getByRole("button", { name: "ดูรายละเอียดการจอง" }).click();

  // Booking detail: the slip is with the venue, not "unpaid".
  //
  // This used to assert "รอชำระเงิน" — which was the bug. A booking sits at
  // pending_payment both before anyone pays and while the venue checks the
  // slip, so the customer was told to pay a second time for money they had
  // already transferred.
  await expect(page).toHaveURL(new RegExp(`/v/${VENUE}/booking/`));
  await expect(page.getByText("รอตรวจสอบสลิป")).toBeVisible();
  await expect(page.getByText("ส่งสลิปแล้ว รอสนามตรวจสอบ")).toBeVisible();
  // The button that caused the double payment must not be here.
  await expect(page.getByRole("link", { name: "ไปชำระเงิน" })).toHaveCount(0);

  fs.unlinkSync(slipPath);

  // Give the slot back. This books for real against a persistent database, so
  // without releasing it every run eats one until the court has none left.
  const bookingId = page.url().split("/booking/")[1]?.split(/[/?#]/)[0];
  const token = await page.evaluate(() => window.localStorage.getItem("sanamspace.token"));
  if (bookingId && token) {
    await request.post(`http://localhost:8000/api/v1/bookings/${bookingId}/cancel`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  }
});
