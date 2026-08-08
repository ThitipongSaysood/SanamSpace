import type { APIRequestContext } from "@playwright/test";

const BASE = "http://localhost:8000/api/v1";

async function token(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${BASE}/auth/admin/login`, {
    data: { email, password: "password" },
  });
  return (await res.json()).token as string;
}

export const ownerToken = (r: APIRequestContext) => token(r, "owner@everyday.test");
export const adminToken = (r: APIRequestContext) => token(r, "super@sanamspace.test");

/** The venue's billing state, straight from the API. */
export async function ownerBilling(request: APIRequestContext) {
  const t = await ownerToken(request);
  const res = await request.get(`${BASE}/owner/billing`, {
    headers: { Authorization: `Bearer ${t}`, Accept: "application/json" },
  });
  return (await res.json()).data;
}

/**
 * Tax documents only exist when the platform is VAT-registered.
 *
 * `vat_enabled` ships OFF — whether a business charges VAT is its own decision,
 * not a sensible default — so a spec that asserts a ใบกำกับภาษี has to say so.
 * Without this the receipt renders with no tax block and the assertions fail
 * for a reason that has nothing to do with the code under test.
 */
export async function enableVat(request: APIRequestContext): Promise<void> {
  const admin = await adminToken(request);
  await request.put(`${BASE}/admin/settings`, {
    headers: { Authorization: `Bearer ${admin}`, Accept: "application/json" },
    data: { vatEnabled: true, vatRate: 7 },
  });
}

/**
 * Start a spec from "nothing owed", whatever a previous one left behind.
 *
 * These run against a real database and only one invoice may be outstanding at
 * a time, so a leftover would be handed back instead of a fresh one — and the
 * venue would land on the review screen instead of the pay screen.
 */
export async function clearOutstanding(request: APIRequestContext): Promise<void> {
  const billing = await ownerBilling(request);
  const id = billing?.outstandingInvoice?.id as string | undefined;
  if (!id) return;

  const admin = await adminToken(request);
  await request.post(`${BASE}/admin/invoices/${id}/reject`, {
    headers: { Authorization: `Bearer ${admin}`, Accept: "application/json" },
    data: { reason: "e2e cleanup" },
  });
}
