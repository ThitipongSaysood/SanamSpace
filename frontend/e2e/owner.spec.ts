import { test, expect } from "@playwright/test";

// Requires the backend running on NEXT_PUBLIC_API_URL with the seeded owner user.
test("owner can log in and reach the dashboard", async ({ page }) => {
  // Owner portal is backend-only (no mock). Skip unless explicitly running real-mode e2e.
  test.skip(!process.env.E2E_OWNER, "requires backend + NEXT_PUBLIC_API_URL (run with E2E_OWNER=1)");
  await page.goto("/owner/login");
  await page.locator('input[type="email"]').fill("owner@everyday.test");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

  // Lands on the redesigned owner dashboard (stat cards + sidebar).
  await expect(page).toHaveURL(/\/owner$/);
  await expect(page.getByText("รายได้วันนี้").first()).toBeVisible();

  // The live floor, above the charts. Asserted on the venue clock it prints:
  // the board is only useful if it agrees with the clock on the wall, and the
  // server runs on UTC.
  const board = page.locator("section", { hasText: "สถานะสด" }).first();
  await expect(board).toBeVisible();
  await expect(board.getByText(/เวลาสนาม \d{2}:\d{2}/)).toBeVisible();
  await expect(board.getByText(/กำลังเล่น \d+ \/ \d+ คอร์ท/)).toBeVisible();
});

/**
 * The day's operations screen.
 *
 * The assertion that matters is the clock: the timeline is today on the
 * VENUE's clock, and the server runs on UTC. A screen built on the server's
 * "today" reports yesterday until 07:00 in Bangkok.
 */
test("the operations centre shows today on the venue's clock", async ({ page }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend + NEXT_PUBLIC_API_URL (run with E2E_OWNER=1)");
  await page.goto("/owner/login");
  await page.locator('input[type="email"]').fill("owner@everyday.test");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/owner$/);

  await page.goto("/owner/operations");
  // Thai: the app's DEFAULT_LOCALE is "th" and these specs run without touching
  // the switcher. This assertion was translated to English on its own during
  // the bilingual pass while the five around it stayed Thai, so it could never
  // match — and nobody saw it, because the e2e suite was not being run.
  await expect(page.getByRole("heading", { name: "ศูนย์ปฏิบัติการ" })).toBeVisible();
  await expect(page.getByText(/เวลาสนาม \d{2}:\d{2}/)).toBeVisible();

  // Either there is work to do or there explicitly is not — never a silent gap.
  await expect(page.getByText(/ต้องจัดการ \d+ รายการ|ไม่มีอะไรค้าง/)).toBeVisible();

  await expect(page.getByRole("heading", { name: /ไทม์ไลน์วันนี้/ })).toBeVisible();
});
