import { test, expect, type APIRequestContext } from "@playwright/test";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1";
const VENUE = "Everyday";

test.skip(!process.env.E2E_OWNER, "requires backend + NEXT_PUBLIC_API_URL (run with E2E_OWNER=1)");

async function adminHeaders(request: APIRequestContext) {
  const login = await request.post(`${API}/auth/admin/login`, {
    data: { email: "super@sanamspace.test", password: "password" },
  });
  return { Authorization: `Bearer ${(await login.json()).token}` };
}

async function planIds(request: APIRequestContext, headers: Record<string, string>) {
  const plans = (await (await request.get(`${API}/admin/plans`, { headers })).json()).data as {
    id: string;
    code: string;
  }[];
  return Object.fromEntries(plans.map((p) => [p.code, p.id]));
}

async function movePlan(request: APIRequestContext, headers: Record<string, string>, planId: string) {
  const subs = (await (await request.get(`${API}/admin/subscriptions`, { headers })).json()).data as {
    id: string;
    organizationName: string;
  }[];
  const sub = subs.find((s) => s.organizationName?.includes(VENUE))!;
  const res = await request.put(`${API}/admin/subscriptions/${sub.id}/plan`, { headers, data: { planId } });
  expect(res.ok()).toBeTruthy();
}

async function ownerMenu(page: import("@playwright/test").Page) {
  await page.goto("/owner/login");
  await page.locator('input[type="email"]').fill("owner@everyday.test");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/owner$/);
  return page.getByRole("navigation", { name: "เมนูหลัก" });
}

/**
 * The plan a venue pays for decides what it sees.
 *
 * Until this existed the matrix was decoration: a Starter venue at ฿990 had the
 * same portal as a Pro one. What matters in a browser is the pairing — the paid
 * menus disappear AND the venue can still run itself, because gating the core
 * would turn a pricing decision into an outage.
 */
test("the owner menu follows the plan, and the core survives the cheapest one", async ({ page, request }) => {
  const headers = await adminHeaders(request);
  const plans = await planIds(request, headers);

  try {
    await movePlan(request, headers, plans.starter);

    const nav = await ownerMenu(page);
    await expect(nav.getByText("ขายหน้าร้าน")).toHaveCount(0);
    await expect(nav.getByText("CRM")).toHaveCount(0);
    await expect(nav.getByText("ยิงโปร LINE")).toHaveCount(0);
    await expect(nav.getByText("เครดิตลูกค้า")).toHaveCount(0);

    // …and everything needed to run a venue is still there.
    for (const core of ["การจอง", "ตรวจสลิป", "สแกน / เช็คอิน", "คืนเงิน", "คอร์ท", "พนักงาน"]) {
      await expect(nav.getByText(core, { exact: true })).toBeVisible();
    }

    // Upgrading gives it back, without a deploy or a re-login.
    await movePlan(request, headers, plans.business);
    await page.reload();
    await expect(nav.getByText("ขายหน้าร้าน")).toBeVisible();
    // Business buys the shop; the marketing tools are the tier above.
    await expect(nav.getByText("CRM")).toHaveCount(0);

    await movePlan(request, headers, plans.pro);
    await page.reload();
    await expect(nav.getByText("CRM")).toBeVisible();
  } finally {
    // Put the demo venue back however this ends — a spec that leaves the demo
    // on Starter breaks every other screen someone opens afterwards.
    await movePlan(request, headers, plans.pro);
  }
});
