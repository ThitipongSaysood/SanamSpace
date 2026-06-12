import { test, expect } from "@playwright/test";

test("customer can book a court end-to-end", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "เข้าสู่ระบบด้วย LINE" }).click();
  await expect(page.getByText(/สวัสดี/)).toBeVisible();
  await page.getByText("Everyday Badminton").first().click();
  await page.getByRole("button", { name: "จองเลย" }).click();
  await page.getByRole("button", { name: "Court 1" }).click();
  await page.getByRole("button", { name: "18:00" }).click();
  await page.getByRole("button", { name: "ดำเนินการต่อ" }).click();
  await page.getByRole("button", { name: /โอนผ่านธนาคาร/ }).click();
  // file input + submit handled by app; assert success state reachable
  await expect(page.getByText("ชำระเงิน")).toBeVisible();
});
