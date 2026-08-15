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

/**
 * A venue with more than one branch, looked at one branch at a time.
 *
 * The portal was organization-scoped from end to end, and the header carried a
 * button reading "Everyday Badminton" that was wired to nothing. What is
 * asserted here is the whole path in one go — header switcher → stored scope →
 * request → the numbers on the page — because each half is useless alone: a
 * switcher that changes no figures, or a filtered endpoint nobody can reach.
 */
test("an owner with two branches can look at one of them, then at both", async ({ page }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend + NEXT_PUBLIC_API_URL (run with E2E_OWNER=1)");
  await page.goto("/owner/login");
  await page.locator('input[type="email"]').fill("owner@everyday.test");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/owner$/);

  const scope = page.locator("header select").last();
  await expect(scope).toBeVisible();

  const board = page.locator("section", { hasText: "สถานะสด" }).first();
  await expect(board.getByText(/กำลังเล่น \d+ \/ \d+ คอร์ท/)).toBeVisible();
  const combined = await board.getByText(/กำลังเล่น \d+ \/ (\d+) คอร์ท/).innerText();

  // The second branch of the seeded venue.
  await scope.selectOption({ index: 2 });
  await expect(page.getByText(/เฉพาะสาขา/)).toBeVisible();

  // Fewer courts than the whole venue — the board follows the scope rather than
  // listing every branch under a heading naming one.
  await expect(board.getByText(/กำลังเล่น \d+ \/ \d+ คอร์ท/)).not.toHaveText(combined);

  // The scope is the venue's, not the page's: it survives navigating away.
  await page.goto("/owner/bookings");
  await expect(page.getByText(/เฉพาะสาขา/)).toBeVisible();

  // ...and back to every branch.
  await page.locator("header select").last().selectOption({ index: 0 });
  await expect(page.getByText("· ทุกสาขา")).toBeVisible();
});
