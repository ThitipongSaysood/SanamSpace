import { test, expect, type APIRequestContext } from "@playwright/test";

const VENUE = "everyday-badminton";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1";

test.skip(
  !process.env.E2E_OWNER,
  "requires backend + NEXT_PUBLIC_API_URL (run with E2E_OWNER=1)",
);

async function ownerHeaders(request: APIRequestContext) {
  const login = await request.post(`${API}/auth/admin/login`, {
    data: { email: "owner@everyday.test", password: "password" },
  });
  return {
    Authorization: `Bearer ${(await login.json()).token}`,
    "X-Venue-Slug": VENUE,
  };
}

/**
 * How a duplicate is really made, and how staff put it right.
 *
 * The venue books someone at the counter for months, and one day that person
 * signs in with LINE — a second row, with the points and credit split between
 * them. Nothing here is contrived: both rows are created the way the product
 * creates them.
 */
test("a walk-in and their LINE account can be folded into one customer", async ({
  page,
  request,
}) => {
  const headers = await ownerHeaders(request);
  const courts = await (
    await request.get(`${API}/owner/courts`, { headers })
  ).json();
  const courtId = courts.data[0].id;
  const date = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10);

  // A number nobody else in the demo data uses, so the group is unambiguous.
  const suffix = String(Date.now()).slice(-7);
  const phone = `081${suffix}`;

  // 1. The counter books them as a walk-in.
  const booking = await request.post(`${API}/owner/bookings`, {
    headers,
    data: {
      courtId,
      date,
      start: "07:00",
      end: "08:00",
      customerName: "คุณซ้ำ (หน้าร้าน)",
      customerPhone: phone,
      status: "confirmed",
    },
  });
  expect(booking.ok(), await booking.text()).toBeTruthy();
  const bookingId = (await booking.json()).data.id as string;

  try {
    // 2. Later, the same person signs in with LINE — a second record.
    const login = await request.post(`${API}/auth/line/login`, {
      data: {
        organizationSlug: VENUE,
        lineUserId: `Umerge${suffix}`,
        displayName: "คุณซ้ำ (LINE)",
      },
    });
    const customerToken = (await login.json()).token as string;

    // 3. …and fills in their phone. Now two rows share one number.
    const profile = await request.put(`${API}/auth/me`, {
      headers: {
        Authorization: `Bearer ${customerToken}`,
        "X-Venue-Slug": VENUE,
      },
      data: { phone },
    });
    expect(profile.ok()).toBeTruthy();

    // 4. The venue sees the pair and folds it together.
    await page.goto("/owner/login");
    await page.locator('input[type="email"]').fill("owner@everyday.test");
    await page.locator('input[type="password"]').fill("password");
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
    await expect(page).toHaveURL(/\/owner$/);

    await page.goto("/owner/customers");
    const group = page.locator("li", { hasText: phone }).first();
    await expect(group).toBeVisible();

    // Keep the walk-in row — it is the one carrying the booking history.
    await group
      .getByRole("button", { name: "เก็บใบนี้ รวมที่เหลือเข้ามา" })
      .first()
      .click();
    const sheet = page.getByRole("dialog", { name: "ยืนยันการรวมลูกค้า" });
    await expect(sheet).toBeVisible();
    await sheet
      .getByRole("button", { name: "รวมเข้าใบที่เก็บ" })
      .first()
      .click();

    // The pair is no longer a pair — which is also this spec cleaning up after
    // itself, since a leftover duplicate would sit in the venue's list forever.
    await expect(page.locator("li", { hasText: phone })).toHaveCount(0);
  } finally {
    // Give the slot back whatever happened. This books for real against a
    // persistent database: released only on success, one failure anywhere above
    // leaves 07:00 taken and every run after it fails on the clash rather than
    // on the thing that actually broke.
    await request.post(`${API}/owner/bookings/${bookingId}/cancel`, {
      headers,
      failOnStatusCode: false,
    });
  }
});
