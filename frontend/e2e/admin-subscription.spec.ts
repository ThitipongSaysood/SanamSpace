import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

test.skip(!process.env.E2E_OWNER, "requires backend + NEXT_PUBLIC_API_URL (run with E2E_OWNER=1)");

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1";
const VENUE = "everyday-badminton";

async function adminHeaders(request: APIRequestContext) {
  const login = await request.post(`${API}/auth/admin/login`, {
    data: { email: "super@sanamspace.test", password: "password" },
  });
  return { Authorization: `Bearer ${(await login.json()).token}` };
}

/** Leave no unpaid invoice behind: the next run would start mid-flow. */
async function clearOutstanding(request: APIRequestContext, headers: Record<string, string>) {
  const invoices = (await (await request.get(`${API}/admin/invoices`, { headers })).json()).data as {
    id: string;
    status: string;
    organizationId?: string | null;
  }[];

  for (const inv of invoices.filter((i) => ["unpaid", "overdue", "pending_review"].includes(i.status))) {
    await request.post(`${API}/admin/invoices/${inv.id}/reject`, {
      headers,
      data: { reason: "ยกเลิกหลังทดสอบอัตโนมัติ" },
    });
  }
}

async function openSubscriptionTab(page: Page) {
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill("super@sanamspace.test");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto("/admin/organizations");
  await page.getByRole("row", { name: /Everyday/ }).getByRole("button").first().click();
  // Exact: the shortcut on the overview tab reads "จัดการการสมัครใช้งาน" and
  // would otherwise match the tab name too.
  await page.getByRole("button", { name: "การสมัครใช้งาน", exact: true }).click();
}

/**
 * Renewing a venue used to mean three screens: read the expiry date here,
 * raise the invoice on the billing page, come back and approve it.
 *
 * Deliberately not marking it paid — a spec that buys the demo venue a year
 * every run makes every expiry assertion after it meaningless.
 */
test("an admin can renew a venue from the screen that shows its expiry", async ({ page, request }) => {
  const headers = await adminHeaders(request);
  await clearOutstanding(request, headers);

  try {
    await openSubscriptionTab(page);

    await expect(page.getByRole("heading", { name: "ต่ออายุ" })).toBeVisible();
    await page.getByRole("button", { name: "3 เดือน" }).click();

    // The price for the length chosen, before committing to anything.
    await expect(page.getByText(/× 3 =/)).toBeVisible();

    await page.getByRole("button", { name: "ออกใบแจ้งหนี้ 3 เดือน" }).click();
    await expect(page.getByRole("status")).toContainText("ออกใบแจ้งหนี้");

    // Asking again must reuse it rather than bill the venue twice — and say so,
    // instead of letting the admin believe a second invoice went out.
    await page.getByRole("button", { name: "ออกใบแจ้งหนี้ 3 เดือน" }).click();
    await expect(page.getByRole("status")).toContainText("ใช้ใบแจ้งหนี้ที่ค้างอยู่");
  } finally {
    await clearOutstanding(request, headers);
  }
});

/**
 * The manual expiry date moves no money, which is why it asks for a reason —
 * and why that reason has to end up somewhere an auditor can read it.
 */
test("a hand-edited expiry date demands a reason and lands in the history", async ({ page, request }) => {
  const headers = await adminHeaders(request);
  const before = (await (await request.get(`${API}/admin/organizations/${VENUE}`, { headers })).json()).data
    .subscription.endsAt as string;

  try {
    await openSubscriptionTab(page);
    await page.getByRole("button", { name: "แก้วันหมดอายุด้วยมือ" }).click();

    const save = page.getByRole("button", { name: "บันทึก" });
    await page.locator('input[type="date"]').fill("2027-01-31");
    await expect(save).toBeDisabled();

    await page.getByPlaceholder(/เหตุผล/).fill("ทดสอบอัตโนมัติ · ชดเชยระบบล่ม");
    await save.click();
    await expect(page.getByRole("status")).toContainText("แก้วันหมดอายุแล้ว");

    await page.getByRole("button", { name: "ประวัติ", exact: true }).click();
    await expect(page.getByText("แก้วันหมดอายุด้วยมือ").first()).toBeVisible();
    await expect(page.getByText(/ชดเชยระบบล่ม/).first()).toBeVisible();
  } finally {
    // Put the date back: every other spec assumes the demo venue is current.
    await request.put(`${API}/admin/organizations/${VENUE}/expiry`, {
      headers,
      data: { endsAt: before, reason: "คืนค่าหลังทดสอบอัตโนมัติ" },
    });
  }
});
