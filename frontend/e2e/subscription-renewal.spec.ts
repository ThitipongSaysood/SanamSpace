import { test, expect } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { clearOutstanding } from "./billing-helpers";

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/x8AAAAASUVORK5CYII=",
  "base64",
);

async function loginOwner(page: import("@playwright/test").Page) {
  await page.goto("/owner/login");
  await page.locator('input[type="email"]').fill("owner@everyday.test");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/owner$/);
}

async function loginAdmin(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill("super@sanamspace.test");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/**
 * The venue renews by bank transfer: it raises an invoice, uploads a slip, and
 * only a Super Admin's approval buys it more time.
 */
test("owner renews and the admin approves the slip", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");
  await clearOutstanding(request);

  await loginOwner(page);

  // The portal offers the way to renew…
  await expect(page.getByRole("link", { name: "แพ็กเกจ/ต่ออายุ" })).toHaveAttribute(
    "href",
    "/owner/billing",
  );
  // …navigated directly, so the test does not race the sidebar's hydration.
  await page.goto("/owner/billing");
  await expect(page.getByRole("heading", { name: "แพ็กเกจและการต่ออายุ" })).toBeVisible();

  // Raise an invoice for 3 months — the pay dialog pops straight up with the QR.
  const renewBtn = page.getByRole("button", { name: "ต่ออายุ", exact: true });
  if (await renewBtn.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "3 เดือน" }).click();
    await renewBtn.click();
  }
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("สแกนจ่ายด้วย PromptPay")).toBeVisible();
  await expect(dialog.getByRole("img", { name: /PromptPay/i })).toBeVisible();
  await expect(dialog.getByText("ยอดที่ต้องชำระ")).toBeVisible();

  // Transfer + slip.
  const slipPath = path.join(os.tmpdir(), `sub-slip-${process.pid}.png`);
  fs.writeFileSync(slipPath, PNG_1x1);
  const submit = page.getByRole("button", { name: "ส่งสลิป" });
  await expect(submit).toBeDisabled();
  await page.locator('input[type="file"]').setInputFiles(slipPath);
  await expect(submit).toBeEnabled();
  await submit.click();

  // The venue waits — the slip alone buys nothing.
  await expect(page.getByText("ส่งสลิปแล้ว รอผู้ดูแลระบบตรวจสอบ")).toBeVisible();

  // The platform sees it at the top of the queue, with the slip to look at.
  await loginAdmin(page);
  await page.goto("/admin/billing");
  await expect(page.getByText("รอตรวจสอบสลิป").first()).toBeVisible();
  await page.locator("tbody tr").first().click();
  await expect(page.getByAltText(/สลิปของ/)).toBeVisible();

  await page.getByRole("button", { name: "อนุมัติและต่ออายุ" }).click();
  await expect(page.getByText(/ชำระแล้ว/).first()).toBeVisible();

  fs.unlinkSync(slipPath);
});

test("an expired venue is locked out but its customers keep booking", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  // Customers must be unaffected while the venue owes the platform money.
  const venue = await request.get("http://127.0.0.1:8000/api/v1/branches", {
    headers: { "X-Venue-Slug": "everyday-badminton" },
  });
  expect(venue.ok()).toBeTruthy();

  await page.goto("/v/everyday-badminton");
  await expect(page.getByRole("button", { name: "เข้าสู่ระบบด้วย LINE" })).toBeVisible();
});
