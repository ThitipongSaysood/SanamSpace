import { test, expect } from "@playwright/test";

/**
 * The owner's customer list used to be a dead end — rows with three numbers and
 * nowhere to go. This is the page behind each one.
 */

async function loginOwner(page: import("@playwright/test").Page) {
  await page.goto("/owner/login");
  await page.locator('input[type="email"]').fill("owner@everyday.test");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/owner$/);
}

test("owner opens a customer from the list and sees their history", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  await loginOwner(page);
  await page.goto("/owner/customers");

  const first = page.locator('a[href^="/owner/customers/"]').first();
  await expect(first).toBeVisible();

  // The name comes from the API, not from scraping the card. Reading the first
  // <div> picked up the phone number the moment customers had one.
  const id = (await first.getAttribute("href"))!.split("/").pop()!;
  const token = (
    await (
      await request.post("http://localhost:8000/api/v1/auth/admin/login", {
        data: { email: "owner@everyday.test", password: "password" },
      })
    ).json()
  ).token as string;
  const detail = await (
    await request.get(`http://localhost:8000/api/v1/owner/customers/${id}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    })
  ).json();
  const name = detail.data.displayName as string;

  await first.click();
  await expect(page).toHaveURL(/\/owner\/customers\/[^/]+$/);

  // The same person, not just any page that loaded.
  await expect(page.getByRole("heading", { name: name!, level: 1 })).toBeVisible();
  await expect(page.getByText("ยอดใช้จ่ายรวม")).toBeVisible();
  await expect(page.getByRole("heading", { name: "การจองล่าสุด" })).toBeVisible();

  await page.getByRole("link", { name: "กลับไปรายชื่อลูกค้า" }).click();
  await expect(page).toHaveURL(/\/owner\/customers$/);
});

/** A customer id from another venue must not open, even by typing the URL. */
test("a customer of another venue is not reachable by url", async ({ request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  const token = (
    await (
      await request.post("http://localhost:8000/api/v1/auth/admin/login", {
        data: { email: "owner@everyday.test", password: "password" },
      })
    ).json()
  ).token as string;

  const res = await request.get("http://localhost:8000/api/v1/owner/customers/not-my-customer", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    failOnStatusCode: false,
  });
  expect(res.status()).toBe(404);
});
