import { test, expect } from "@playwright/test";
import jsQR from "jsqr";
import { PNG } from "pngjs";

/**
 * QR check-in, end to end: the customer shows, the counter scans.
 *
 * What this replaced: a decorative grid of squares no reader could parse, a
 * hard-coded countdown, and a button on the customer's own screen that marked
 * their booking complete.
 */

const BASE = "http://localhost:8000/api/v1";
const SLUG = "everyday-badminton";

type Req = import("@playwright/test").APIRequestContext;

async function ownerHeaders(request: Req) {
  const res = await request.post(`${BASE}/auth/admin/login`, {
    data: { email: "owner@everyday.test", password: "password" },
  });
  return { Authorization: `Bearer ${(await res.json()).token}`, Accept: "application/json" };
}

async function setCheckin(request: Req, enabled: boolean) {
  const res = await request.put(`${BASE}/owner/settings`, {
    headers: await ownerHeaders(request),
    data: { checkinEnabled: enabled },
  });
  expect(res.ok()).toBeTruthy();
}

/**
 * Sign in as the customer and return a confirmed booking of theirs, making one
 * through the owner's counter if they have none.
 *
 * The three specs below used to `test.skip()` themselves when the customer had
 * nothing booked — and on a freshly seeded database that is always, because the
 * seeder creates no bookings. They ran only while an earlier run's leftovers
 * were still in the shared dev database, and reported "skipped" rather than
 * "failed" the moment it was reset, so nothing ever complained. A spec that
 * needs a booking should make one.
 */
async function customerBooking(page: import("@playwright/test").Page, request?: Req) {
  await page.goto(`/v/${SLUG}`);
  await page.getByRole("button", { name: "เข้าสู่ระบบด้วย LINE" }).click();
  await expect(page).toHaveURL(new RegExp(`/v/${SLUG}/home`));
  await page.keyboard.press("Escape"); // the venue may greet with a popup

  const token = await page.evaluate(() => window.localStorage.getItem("sanamspace.token"));
  const bookings = await page.evaluate(async (t) => {
    const r = await fetch("http://localhost:8000/api/v1/bookings", {
      headers: { Authorization: `Bearer ${t}`, Accept: "application/json", "X-Venue-Slug": "everyday-badminton" },
    });
    return (await r.json()).data as { id: string; status: string; checkinToken: string; code: string }[];
  }, token);

  const existing = bookings.find((b) => b.status === "confirmed");
  if (existing || !request) return existing ?? null;

  // Booked from the counter, at a fixed hour tomorrow: a slot built from "now"
  // crosses midnight late in the evening and is refused (end must be after
  // start), which is the trap this suite has already been caught by once.
  const headers = await ownerHeaders(request);
  const courts = (await (await request.get(`${BASE}/owner/courts`, { headers })).json()).data as { id: string }[];
  const customers = (await (await request.get(`${BASE}/owner/customers`, { headers })).json()).data as { id: string }[];
  const tomorrow = new Date(Date.now() + 864e5);
  const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

  for (const court of courts) {
    const created = await request.post(`${BASE}/owner/bookings`, {
      headers,
      data: { courtId: court.id, customerId: customers[0].id, date, start: "10:00", end: "11:00", status: "confirmed" },
      failOnStatusCode: false,
    });
    if (created.ok()) {
      const made = (await created.json()).data as { id: string; status: string; checkinToken: string; code: string };
      return made;
    }
  }

  return null;
}

test("the customer's QR is real, and it encodes the check-in token", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  await setCheckin(request, true);
  const booking = await customerBooking(page, request);
  test.skip(!booking, "no confirmed booking to show a QR for");

  await page.goto(`/v/${SLUG}/booking/${booking!.id}/qr`);
  const img = page.locator('img[alt^="QR"]');
  await expect(img).toBeVisible();

  // Decoded for real rather than trusted: the previous version rendered a grid
  // of coloured divs that looked like a QR and scanned as nothing.
  const src = await img.getAttribute("src");
  const png = PNG.sync.read(Buffer.from(src!.split(",")[1], "base64"));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);

  expect(decoded?.data).toBe(booking!.checkinToken);
});

test("the counter checks a customer in, and a second scan is not an error", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  await setCheckin(request, true);
  const headers = await ownerHeaders(request);

  // A slot happening right now, so the time window is open.
  //
  // Both halves of this used to break for eight hours a day and pass for the
  // other sixteen. `now + 55 minutes` crossed midnight after 23:05 and produced
  // an end EARLIER than its start, which the API rightly refuses (`after:start`)
  // — so every court "failed" and the test reported that the venue was fully
  // booked. And the date came from `toISOString()`, which is UTC: between
  // midnight and 07:00 in Bangkok that is YESTERDAY, so the booking landed on
  // the wrong day while the times said today.
  //
  // A booking cannot span midnight in this product, so the slot is clipped to
  // the end of the venue's day and the date is taken from the local clock.
  const now = new Date();
  const hh = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const localDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 0, 0);
  const end = new Date(Math.min(now.getTime() + 55 * 60_000, endOfDay.getTime()));
  const start = new Date(Math.min(now.getTime() - 5 * 60_000, end.getTime() - 10 * 60_000));

  // In the last minute of the day no slot can both be in progress and end
  // before midnight — that is the product's rule, not a gap in the test.
  test.skip(end.getTime() <= now.getTime(), "no in-progress slot can exist this close to midnight");
  const courts = (await (await request.get(`${BASE}/owner/courts`, { headers })).json()).data as { id: string }[];
  const customers = (await (await request.get(`${BASE}/owner/customers`, { headers })).json()).data as {
    id: string;
  }[];

  // Try each court: this runs against a persistent database, so which slot is
  // free right now differs between runs.
  let bookingId: string | null = null;
  for (const court of courts) {
    const created = await request.post(`${BASE}/owner/bookings`, {
      headers,
      data: {
        courtId: court.id,
        customerId: customers[0].id,
        date: localDate(now),
        start: hh(start),
        end: hh(end),
        status: "confirmed",
      },
      failOnStatusCode: false,
    });
    if (created.ok()) {
      bookingId = (await created.json()).data.id as string;
      break;
    }
  }
  expect(bookingId, "every court is busy right now — no slot to check in to").not.toBeNull();

  await page.goto("/owner/login");
  await page.locator('input[type="email"]').fill("owner@everyday.test");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/owner$/);
  await page.goto("/owner/checkin");

  // Typed code, because a headless browser has no camera. Same endpoint.
  const code = (await (await request.get(`${BASE}/owner/bookings/${bookingId}`, { headers })).json()).data
    .code as string;

  await page.locator("#manual-code").fill(code);
  await page.getByRole("button", { name: "ตรวจสอบ", exact: true }).click();
  await expect(page.getByText("เช็คอินสำเร็จ")).toBeVisible();

  // Scanning twice is a normal thing to do at a busy counter.
  await page.locator("#manual-code").fill(code);
  await page.getByRole("button", { name: "ตรวจสอบ", exact: true }).click();
  await expect(page.getByText(/เช็คอินแล้วเมื่อ/)).toBeVisible();

  // …and they appear in the arrivals list.
  await expect(page.getByRole("heading", { name: "เช็คอินล่าสุด" })).toBeVisible();

  // Give the slot back. This books for real against a persistent database, so
  // without releasing it every run eats one until no court is free at this hour
  // — which is exactly how this test first failed.
  await request.post(`${BASE}/owner/bookings/${bookingId}/cancel`, { headers, failOnStatusCode: false });
});

test("a venue that switches check-in off stops showing its customers a QR", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  await setCheckin(request, false);
  const booking = await customerBooking(page, request);
  test.skip(!booking, "no confirmed booking to check");

  await page.goto(`/v/${SLUG}/booking/${booking!.id}`);
  await expect(page.getByRole("link", { name: /QR Check-in/ })).toHaveCount(0);

  // Even by URL, the screen says why rather than drawing a useless code.
  await page.goto(`/v/${SLUG}/booking/${booking!.id}/qr`);
  await expect(page.getByText("สนามนี้ไม่ได้ใช้ระบบเช็คอินด้วย QR")).toBeVisible();

  await setCheckin(request, true);
  await page.goto(`/v/${SLUG}/booking/${booking!.id}`);
  await expect(page.getByRole("link", { name: /QR Check-in/ })).toBeVisible();
});

/** The switch on the check-in page itself, where someone actually looks for it. */
test("the counter can switch check-in off from its own screen", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  await setCheckin(request, true);

  await page.goto("/owner/login");
  await page.locator('input[type="email"]').fill("owner@everyday.test");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/owner$/);
  await page.goto("/owner/checkin");

  const toggle = page.getByRole("button", { name: /ระบบเช็คอิน/ });
  await expect(toggle).toContainText("เปิด");

  await toggle.click();
  await expect(toggle).toContainText("ปิด");
  await expect(page.getByText(/ลูกค้าจะไม่เห็นหน้า QR/)).toBeVisible();

  // …and it really reached the venue's public branding, not just this screen.
  const pub = await (await request.get(`${BASE}/orgs/${SLUG}/public`)).json();
  expect(pub.checkinEnabled).toBe(false);

  await toggle.click();
  await expect(toggle).toContainText("เปิด");
});

/** The customer holds the token, but must not be able to spend it. */
test("a customer cannot check themselves in", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  const booking = await customerBooking(page, request);
  test.skip(!booking, "no confirmed booking to check");

  const token = await page.evaluate(() => window.localStorage.getItem("sanamspace.token"));
  const auth = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  // The old self-service route is gone entirely…
  const gone = await request.post(`${BASE}/bookings/${booking!.id}/checkin`, {
    headers: auth,
    failOnStatusCode: false,
  });
  expect(gone.status()).toBe(404);

  // …and the counter's endpoint is not theirs to call.
  const denied = await request.post(`${BASE}/owner/checkin`, {
    headers: auth,
    data: { token: booking!.checkinToken },
    failOnStatusCode: false,
  });
  expect(denied.status()).toBe(403);
});
