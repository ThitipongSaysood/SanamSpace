import { test, expect } from "@playwright/test";
import { clearOutstanding, ownerBilling, ownerToken } from "./billing-helpers";

/**
 * The platform operator's side of renewal: bill a venue, and see the queue of
 * transfer slips waiting on a decision.
 */

async function loginAdmin(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill("super@sanamspace.test");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("admin bills a venue and the venue sees the invoice", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  await clearOutstanding(request);

  // Resolved from the slug: the venue's display name is the owner's to change.
  const org = await (await request.get("http://localhost:8000/api/v1/orgs/everyday-badminton/public")).json();

  await loginAdmin(page);
  await page.goto("/admin/subscriptions");

  const row = page.locator("tbody tr", { hasText: org.name }).first();
  await row.getByRole("button", { name: "ออกใบแจ้งหนี้" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "3 เดือน" }).click();
  await dialog.getByRole("button", { name: "ออกใบแจ้งหนี้" }).click();

  // Lands on billing with the new invoice at hand.
  await expect(page).toHaveURL(/\/admin\/billing$/);
  await expect(page.getByText("ยังไม่ชำระ").first()).toBeVisible();

  // The venue sees the very same invoice on its own page, marked as ours.
  const billing = await ownerBilling(request);
  expect(billing.outstandingInvoice).not.toBeNull();
  expect(billing.outstandingInvoice.source).toBe("admin");
  expect(billing.outstandingInvoice.periodMonths).toBe(3);
});

test("the nav counts slips waiting for review", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  // Pay the outstanding invoice as the venue would, so a slip is waiting.
  const token = await ownerToken(request);
  const billing = await ownerBilling(request);
  const invoiceId = billing.outstandingInvoice?.id as string | undefined;
  test.skip(!invoiceId, "no outstanding invoice to pay");

  await request.post(`http://localhost:8000/api/v1/owner/billing/invoices/${invoiceId}/slip`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    multipart: {
      slip: { name: "slip.png", mimeType: "image/png", buffer: PNG },
    },
  });

  await loginAdmin(page);
  const badge = page.getByLabel(/สลิปรอตรวจสอบ/);
  await expect(badge.first()).toBeVisible();
});

// A small, genuinely decodable PNG (Chrome rejects hand-rolled ones).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/x8AAAAASUVORK5CYII=",
  "base64",
);
