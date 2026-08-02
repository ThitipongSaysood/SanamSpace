import { test, expect } from "@playwright/test";

/**
 * The two admin gaps: adding and suspending a platform user, and editing what a
 * role may do — which used to be a number on a card that nothing read.
 */

const BASE = "http://localhost:8000/api/v1";

async function adminHeaders(request: import("@playwright/test").APIRequestContext) {
  const res = await request.post(`${BASE}/auth/admin/login`, {
    data: { email: "super@sanamspace.test", password: "password" },
  });
  return { Authorization: `Bearer ${(await res.json()).token}`, Accept: "application/json" };
}

async function loginAdmin(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill("super@sanamspace.test");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("admin adds a platform user, then suspends and restores them", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  const email = `e2e-admin-${Date.now()}@sanamspace.test`;

  await loginAdmin(page);
  await page.goto("/admin/users");
  await expect(page.locator("tbody")).toBeVisible();

  await page.getByRole("button", { name: "เพิ่มผู้ใช้" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#u-name").fill("ทีมงาน E2E");
  await dialog.locator("#u-email").fill(email);
  await dialog.locator("#u-password").fill("secret-password");
  await dialog.getByRole("button", { name: "บันทึก" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const row = page.locator("tbody tr", { hasText: email });
  await expect(row).toBeVisible();
  await expect(row).toContainText("ใช้งาน");

  // Suspended: the row stays — the account keeps its name on what it approved.
  await row.getByRole("button", { name: "ระงับ", exact: true }).click();
  await expect(row).toContainText("ระงับแล้ว");

  // …and the account really cannot get back in.
  const denied = await request.post(`${BASE}/auth/admin/login`, {
    data: { email, password: "secret-password" },
    failOnStatusCode: false,
  });
  expect(denied.status()).toBe(422);

  await row.getByRole("button", { name: "คืนสิทธิ์" }).click();
  await expect(row).toContainText("ใช้งาน");

  const allowed = await request.post(`${BASE}/auth/admin/login`, {
    data: { email, password: "secret-password" },
    failOnStatusCode: false,
  });
  expect(allowed.ok()).toBeTruthy();

  // Leave the account suspended rather than deletable — the API has no delete,
  // by design — so repeat runs do not pile up usable logins.
  const headers = await adminHeaders(request);
  const users = (await (await request.get(`${BASE}/admin/users`, { headers })).json()).data as {
    id: string;
    email: string;
  }[];
  const created = users.find((u) => u.email === email);
  if (created) await request.post(`${BASE}/admin/users/${created.id}/suspend`, { headers });
});

test("editing a role's permissions changes what its staff can do", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  const headers = await adminHeaders(request);
  const roles = (await (await request.get(`${BASE}/admin/roles`, { headers })).json()).data as {
    id: string;
    code: string;
    permissionIds: string[];
  }[];
  const cashier = roles.find((r) => r.code === "cashier")!;
  const before = cashier.permissionIds;

  await loginAdmin(page);
  await page.goto("/admin/roles");

  // Roles that bypass every check say so instead of offering a dead editor.
  const owner = page.locator("button", { hasText: "Owner" }).first();
  await expect(owner).toContainText("มีสิทธิ์ทั้งหมดเสมอ");
  await expect(owner).toBeDisabled();

  await page.getByRole("button", { name: /Cashier/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const grant = dialog.locator("label", { hasText: "promotion.manage" }).locator("input");
  await expect(grant).not.toBeChecked();
  await grant.check();
  await dialog.getByRole("button", { name: "บันทึก" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // The card count follows, and so does the API.
  const after = (await (await request.get(`${BASE}/admin/roles`, { headers })).json()).data as {
    code: string;
    permissionIds: string[];
  }[];
  const updated = after.find((r) => r.code === "cashier")!;
  expect(updated.permissionIds.length).toBe(before.length + 1);

  // Put it back so the next run starts where it expects to.
  await request.put(`${BASE}/admin/roles/${cashier.id}/permissions`, {
    headers,
    data: { permissionIds: before },
  });
});
