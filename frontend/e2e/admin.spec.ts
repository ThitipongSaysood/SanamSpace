import { test, expect } from "@playwright/test";

// Requires the backend running on NEXT_PUBLIC_API_URL with the seeded super-admin user.
test("super admin can log in and reach the platform dashboard", async ({ page }) => {
  // Platform admin portal is backend-only (no mock). Skip unless explicitly running real-mode e2e.
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill("super@sanamspace.test");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

  // Lands on the platform shell with a dashboard stat visible.
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("องค์กรทั้งหมด")).toBeVisible();
  // exact: a later chart heading also contains "MRR", and the loose match
  // turned this assertion into a strict-mode violation rather than a check.
  await expect(page.getByText("MRR", { exact: true })).toBeVisible();
});
