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
