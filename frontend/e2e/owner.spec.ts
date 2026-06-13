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
});
