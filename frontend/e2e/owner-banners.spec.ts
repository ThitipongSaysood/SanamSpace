import { test, expect } from "@playwright/test";

/**
 * The owner's banner screen: a compact table, with the full editor and the
 * full-size image both a click away.
 *
 * Stacked full-height forms meant scrolling past a poster to reach the next
 * banner; these assertions are what keeps the list scannable.
 */

const BASE = "http://localhost:8000/api/v1";

async function ownerHeaders(request: import("@playwright/test").APIRequestContext) {
  const res = await request.post(`${BASE}/auth/admin/login`, {
    data: { email: "owner@everyday.test", password: "password" },
  });
  return { Authorization: `Bearer ${(await res.json()).token}`, Accept: "application/json" };
}

async function loginOwner(page: import("@playwright/test").Page) {
  await page.goto("/owner/login");
  await page.locator('input[type="email"]').fill("owner@everyday.test");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/owner$/);
}

test("owner adds, edits, parks and removes a banner from the table", async ({ page }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  await loginOwner(page);
  await page.goto("/owner/banner");

  // Count only once the list has actually rendered — count() does not wait, and
  // an early 0 would make the "one more row" assertion meaningless.
  await expect(page.locator("tbody").or(page.getByText("ยังไม่มีแบนเนอร์"))).toBeVisible();
  const before = await page.locator("tbody tr").count();

  // Adding opens the editor straight away — an empty row is not the goal.
  // exact: the empty state offers "เพิ่มแบนเนอร์แรก", which the substring matches.
  await page.getByRole("button", { name: "เพิ่มแบนเนอร์", exact: true }).click();
  const editor = page.getByRole("dialog");
  await expect(editor.getByRole("heading", { name: "แก้ไขแบนเนอร์" })).toBeVisible();

  const title = `ประกาศ E2E ${Date.now()}`;
  await editor.locator("#b-title").fill(title);
  await editor.locator("#b-message").fill("รายละเอียดจากเทสต์");
  await editor.getByRole("button", { name: "บันทึก" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const row = page.locator("tbody tr", { hasText: title });
  await expect(row).toBeVisible();
  await expect(row).toContainText("รายละเอียดจากเทสต์");
  await expect(page.locator("tbody tr")).toHaveCount(before + 1);

  // Reopening shows what was saved, not a blank form.
  await row.getByRole("button", { name: "แก้ไข" }).click();
  await expect(page.getByRole("dialog").locator("#b-title")).toHaveValue(title);
  await page.getByRole("dialog").getByRole("button", { name: "ยกเลิก" }).click();

  // Parked, not deleted — the row stays, the label flips.
  await expect(row.getByRole("button", { name: "เปิดอยู่" })).toBeVisible();
  await row.getByRole("button", { name: "เปิดอยู่" }).click();
  await expect(row.getByRole("button", { name: "ปิดอยู่" })).toBeVisible();
  await expect(page.locator("tbody tr", { hasText: title })).toHaveCount(1);

  page.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "ลบแบนเนอร์" }).click();
  await expect(page.locator("tbody tr", { hasText: title })).toHaveCount(0);
});

test("the table thumbnail opens the whole image, uncropped", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  // A banner with a known image, so the assertion is about this row.
  const headers = await ownerHeaders(request);
  const title = `รูปเต็ม ${Date.now()}`;
  const created = await request.post(`${BASE}/owner/welcome-banners`, {
    headers,
    data: { title, imageUrl: "http://localhost:8000/storage/uploads/demo-banner.png" },
  });
  const id = (await created.json()).data.id as string;

  await loginOwner(page);
  await page.goto("/owner/banner");

  const row = page.locator("tbody tr", { hasText: title });
  await row.getByRole("button", { name: "ดูรูปเต็ม" }).click();

  const lightbox = page.getByRole("dialog");
  await expect(lightbox).toBeVisible();

  // object-contain, and the rendered box keeps the file's own ratio: the whole
  // poster is on screen rather than a slice of it.
  const shape = await lightbox.locator("img").evaluate((img: HTMLImageElement) => {
    const r = img.getBoundingClientRect();
    return {
      fit: getComputedStyle(img).objectFit,
      natural: img.naturalWidth / img.naturalHeight,
      rendered: r.width / r.height,
    };
  });
  expect(shape.fit).toBe("contain");
  expect(shape.rendered).toBeCloseTo(shape.natural, 2);

  // Escape gets out — clicking the image itself must not close it.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await request.delete(`${BASE}/owner/welcome-banners/${id}`, { headers });
});
