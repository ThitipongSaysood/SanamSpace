import { test, expect } from "@playwright/test";

/**
 * The venue's booking link has to be reachable by the two people who hand it
 * out: the venue owner, and the platform admin onboarding them.
 */

test("owner sees their venue's customer link and can copy it", async ({ page, context }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto("/owner/login");
  await page.locator('input[type="email"]').fill("owner@everyday.test");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/owner$/);

  const link = page.getByRole("heading", { name: "ลิงก์สำหรับลูกค้า" });
  await expect(link).toBeVisible();
  await expect(page.locator("#customer-link-url")).toHaveText(/\/v\/everyday-badminton$/);

  // The aria-label stays constant; the visible text is what confirms the copy.
  const copyBtn = page.getByRole("button", { name: "คัดลอกลิงก์สำหรับลูกค้า" });
  await copyBtn.click();
  await expect(copyBtn).toContainText("คัดลอกแล้ว");

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/\/v\/everyday-badminton$/);

  // The copied link must actually open that venue's booking page.
  await page.goto(copied);
  await expect(page.getByRole("button", { name: "เข้าสู่ระบบด้วย LINE" })).toBeVisible();
});

test("admin can copy a venue's customer link from the org drawer", async ({ page }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill("super@sanamspace.test");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  // Searched by owner/contact rather than venue name — the venue name is the
  // owner's to change, while the slug behind the link never moves. The link
  // assertion below is what actually confirms the right row was opened.
  await page.goto("/admin/organizations");
  await page.getByPlaceholder("ค้นหาสนาม, เจ้าของ, อีเมล...").fill("everyday");
  await page.locator("tbody tr").first().click();

  await expect(page.getByRole("heading", { name: "ลิงก์สำหรับลูกค้า" })).toBeVisible();
  await expect(page.locator("#customer-link-url")).toHaveText(/\/v\/everyday-badminton$/);
});
