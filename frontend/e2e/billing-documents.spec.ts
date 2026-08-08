import { test, expect } from "@playwright/test";
import { adminToken, clearOutstanding, enableVat, ownerBilling, ownerToken } from "./billing-helpers";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/x8AAAAASUVORK5CYII=",
  "base64",
);
const BASE = "http://localhost:8000/api/v1";

async function loginOwner(page: import("@playwright/test").Page) {
  await page.goto("/owner/login");
  await page.locator('input[type="email"]').fill("owner@everyday.test");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/owner$/);
}

/** Renew, pay and approve, leaving a settled invoice behind. */
async function settleOne(request: import("@playwright/test").APIRequestContext) {
  await enableVat(request);
  await clearOutstanding(request);
  const owner = await ownerToken(request);
  await request.post(`${BASE}/owner/billing/renew`, {
    headers: { Authorization: `Bearer ${owner}`, Accept: "application/json" },
    data: { periodMonths: 3 },
  });
  const { outstandingInvoice } = await ownerBilling(request);
  await request.post(`${BASE}/owner/billing/invoices/${outstandingInvoice.id}/slip`, {
    headers: { Authorization: `Bearer ${owner}`, Accept: "application/json" },
    multipart: { slip: { name: "slip.png", mimeType: "image/png", buffer: PNG } },
  });
  const admin = await adminToken(request);
  await request.post(`${BASE}/admin/invoices/${outstandingInvoice.id}/pay`, {
    headers: { Authorization: `Bearer ${admin}`, Accept: "application/json" },
  });
  return outstandingInvoice.id as string;
}

test("the venue can open the receipt for a paid invoice", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");
  await settleOne(request);

  await loginOwner(page);
  await page.goto("/owner/billing");
  await expect(page.getByRole("heading", { name: "แพ็กเกจและการต่ออายุ" })).toBeVisible();

  // A settled row offers ใบเสร็จ, not ใบแจ้งหนี้.
  const row = page.locator("tbody tr").filter({ hasText: "ชำระแล้ว" }).first();
  await row.getByRole("button", { name: "ใบเสร็จ" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("ใบเสร็จรับเงิน/ใบกำกับภาษี").first()).toBeVisible();
  // Its own number series, with the invoice it settles as the reference.
  await expect(dialog.getByText(/RCP-\d{4}-\d{4}/)).toBeVisible();
  await expect(dialog.getByText(/อ้างอิง INV-\d{4}-\d{4}/)).toBeVisible();
  // Both parties, and the tax broken out of the price.
  await expect(dialog.getByText("บริษัท สนามสเปซ จำกัด").first()).toBeVisible();
  await expect(dialog.getByText(/เลขประจำตัวผู้เสียภาษี 0105564000123/)).toBeVisible();
  await expect(dialog.getByText(/ภาษีมูลค่าเพิ่ม 7%/)).toBeVisible();
  await expect(dialog.getByText("* ราคารวมภาษีมูลค่าเพิ่มแล้ว")).toBeVisible();
});

test("an unpaid invoice reads as ใบแจ้งหนี้, not a receipt", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");
  await enableVat(request);
  await clearOutstanding(request);
  const owner = await ownerToken(request);
  await request.post(`${BASE}/owner/billing/renew`, {
    headers: { Authorization: `Bearer ${owner}`, Accept: "application/json" },
    data: { periodMonths: 1 },
  });

  await loginOwner(page);
  await page.goto("/owner/billing");
  // The pay dialog pops up over the page; close it to reach the history.
  // ".last()" picks the footer button — the backdrop and the X share its label.
  await page.getByRole("dialog").getByRole("button", { name: "ปิด" }).last().click();

  const row = page.locator("tbody tr").filter({ hasText: "รอชำระ" }).first();
  await row.getByRole("button", { name: "ใบแจ้งหนี้" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("ใบแจ้งหนี้/ใบกำกับภาษี").first()).toBeVisible();
  await expect(dialog.getByText(/RCP-/)).toHaveCount(0);
});

test("the platform sees the identical document", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");
  const invoiceId = await settleOne(request);

  const owner = await ownerToken(request);
  const admin = await adminToken(request);
  const asOwner = await (
    await request.get(`${BASE}/owner/billing/invoices/${invoiceId}/document`, {
      headers: { Authorization: `Bearer ${owner}`, Accept: "application/json" },
    })
  ).json();
  const asAdmin = await (
    await request.get(`${BASE}/admin/invoices/${invoiceId}/document`, {
      headers: { Authorization: `Bearer ${admin}`, Accept: "application/json" },
    })
  ).json();

  expect(asOwner.data).toEqual(asAdmin.data);
  expect(asOwner.data.kind).toBe("receipt");

  // …and it renders in the admin portal too.
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill("super@sanamspace.test");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/billing");
  await page.locator("tbody tr").first().click();
  await expect(page.getByRole("dialog").getByText(asOwner.data.number)).toBeVisible();
});

test("the receipt opens as a PDF with Thai text", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");
  const invoiceId = await settleOne(request);

  const owner = await ownerToken(request);
  const res = await request.get(`${BASE}/owner/billing/invoices/${invoiceId}/document.pdf`, {
    headers: { Authorization: `Bearer ${owner}`, Accept: "application/pdf" },
  });
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["content-type"]).toContain("application/pdf");

  const body = await res.body();
  expect(body.subarray(0, 4).toString()).toBe("%PDF");
  // The Thai font must be embedded — dompdf's built-ins have no Thai glyphs,
  // and a silent fall back to Helvetica prints a page of empty boxes.
  expect(body.toString("latin1")).toContain("Sarabun");
  expect(body.length).toBeGreaterThan(50_000);

  // …and the button is there for a human to click.
  await loginOwner(page);
  await page.goto("/owner/billing");
  await page.locator("tbody tr").filter({ hasText: "ชำระแล้ว" }).first()
    .getByRole("button", { name: "ใบเสร็จ" }).click();
  await expect(page.getByRole("button", { name: /เปิด PDF ใบเสร็จ/ })).toBeVisible();
});
