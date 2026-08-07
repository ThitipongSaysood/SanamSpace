import { test, expect } from "@playwright/test";

/**
 * What a venue edits in its own settings has to reach its customers.
 *
 * Before this, only `primaryColor` ever left the settings form — secondary,
 * accent and the font were collected and dropped — and branding was re-read
 * only on the /v/{slug} login page, so a signed-in customer kept the old look.
 */

const BASE = "http://localhost:8000/api/v1";
const SLUG = "everyday-badminton";

async function ownerToken(request: import("@playwright/test").APIRequestContext) {
  const res = await request.post(`${BASE}/auth/admin/login`, {
    data: { email: "owner@everyday.test", password: "password" },
  });
  return (await res.json()).token as string;
}

async function setBrand(
  request: import("@playwright/test").APIRequestContext,
  patch: Record<string, string | boolean | null>,
) {
  const token = await ownerToken(request);
  const res = await request.put(`${BASE}/owner/settings`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    data: patch,
  });
  expect(res.ok()).toBeTruthy();
}

type Req = import("@playwright/test").APIRequestContext;
type BannerPatch = Record<string, string | boolean | null>;

async function ownerHeaders(request: Req) {
  return { Authorization: `Bearer ${await ownerToken(request)}`, Accept: "application/json" };
}

/** Create a banner and return its id. */
async function addBanner(request: Req, data: BannerPatch): Promise<string> {
  const res = await request.post(`${BASE}/owner/welcome-banners`, {
    headers: await ownerHeaders(request),
    data,
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data.id as string;
}

async function editBanner(request: Req, id: string, data: BannerPatch) {
  const res = await request.put(`${BASE}/owner/welcome-banners/${id}`, {
    headers: await ownerHeaders(request),
    data,
  });
  expect(res.ok()).toBeTruthy();
}

async function toggleBanner(request: Req, id: string) {
  const res = await request.post(`${BASE}/owner/welcome-banners/${id}/toggle`, {
    headers: await ownerHeaders(request),
  });
  expect(res.ok()).toBeTruthy();
}

/**
 * Delete every banner on the venue.
 *
 * These specs run against a persistent dev database, so a banner left behind
 * would show up on the home page of every later run and change what those
 * assertions see.
 */
async function clearBanners(request: Req) {
  const headers = await ownerHeaders(request);
  const res = await request.get(`${BASE}/owner/welcome-banners`, { headers });
  for (const banner of (await res.json()).data as { id: string }[]) {
    await request.delete(`${BASE}/owner/welcome-banners/${banner.id}`, { headers });
  }
}

test("all three brand colours reach the customer app", async ({ request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  await setBrand(request, {
    primaryColor: "#7C3AED",
    secondaryColor: "#DB2777",
    accentColor: "#FACC15",
  });

  const pub = await (await request.get(`${BASE}/orgs/${SLUG}/public`)).json();
  expect(pub.theme.primary).toBe("#7C3AED");
  expect(pub.theme.secondary).toBe("#DB2777");
  expect(pub.theme.accent).toBe("#FACC15");
});

test("a colour change shows up for a customer already signed in", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  await setBrand(request, { primaryColor: "#7C3AED", secondaryColor: "#DB2777" });

  // Sign in and land inside the venue's app.
  await page.goto(`/v/${SLUG}`);
  await page.getByRole("button", { name: "เข้าสู่ระบบด้วย LINE" }).click();
  await expect(page).toHaveURL(new RegExp(`/v/${SLUG}/home`));

  const brandOf = () =>
    page.evaluate(() => ({
      primary: getComputedStyle(document.body).getPropertyValue("--brand-primary").trim(),
      secondary: getComputedStyle(document.body).getPropertyValue("--brand-secondary").trim(),
    }));

  await expect.poll(async () => (await brandOf()).primary).toBe("#7C3AED");
  await expect.poll(async () => (await brandOf()).secondary).toBe("#DB2777");

  // The venue re-brands while this customer is still signed in…
  await setBrand(request, { primaryColor: "#0EA5E9", secondaryColor: "#0891B2" });

  // …and it reaches them on their next visit — no re-login, no /v/{slug} detour.
  await page.goto(`/v/${SLUG}/bookings`);
  await expect.poll(async () => (await brandOf()).primary, { timeout: 10_000 }).toBe("#0EA5E9");
  await expect.poll(async () => (await brandOf()).secondary).toBe("#0891B2");
});

test("the venue's brand never leaks into the owner or admin portal", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  await setBrand(request, { primaryColor: "#DB2777" });

  await page.goto(`/v/${SLUG}`);
  await page.getByRole("button", { name: "เข้าสู่ระบบด้วย LINE" }).click();
  await expect(page).toHaveURL(new RegExp(`/v/${SLUG}/home`));

  await page.goto("/owner/login");
  const primary = await page.evaluate(() =>
    getComputedStyle(document.body).getPropertyValue("--brand-primary").trim(),
  );
  // Back-office keeps the platform's own colour — same origin, same <body>.
  expect(primary.toUpperCase()).toBe("#16A34A");
});

test.afterAll(async ({ playwright }) => {
  if (!process.env.E2E_OWNER) return;
  // Put the seeded green back so the next run starts where it expects to.
  const request = await playwright.request.newContext();
  await setBrand(request, {
    primaryColor: "#16A34A",
    secondaryColor: "#16A34A",
    accentColor: "#F59E0B",
  });
  await request.dispose();
});

test("the venue's welcome message reaches its customers", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  await clearBanners(request);
  const title = `ยินดีต้อนรับ ${Date.now()}`;
  const id = await addBanner(request, {
    title,
    message: "เปิดทุกวัน 10:00–22:00 · จองล่วงหน้าได้ 7 วัน",
  });

  await page.goto(`/v/${SLUG}`);
  await page.getByRole("button", { name: "เข้าสู่ระบบด้วย LINE" }).click();
  await expect(page).toHaveURL(new RegExp(`/v/${SLUG}/home`));

  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByText("เปิดทุกวัน 10:00–22:00 · จองล่วงหน้าได้ 7 วัน")).toBeVisible();

  // A banner image stands on its own — text is not required alongside it.
  await editBanner(request, id, {
    title: null,
    message: null,
    imageUrl: "http://localhost:8000/storage/uploads/demo-banner.png",
  });
  await page.goto(`/v/${SLUG}/home`);
  await expect(page.getByAltText("แบนเนอร์ของสนาม")).toBeVisible();

  // Deleted → the card goes away rather than leaving an empty box.
  await clearBanners(request);
  await page.goto(`/v/${SLUG}/home`);
  await expect(page.getByAltText("แบนเนอร์ของสนาม")).toHaveCount(0);
});

/**
 * The reason banners are a list: a venue running a holiday notice AND a
 * promotion shows both, and can park one without retyping it later.
 */
test("a venue can run several banners and switch one off", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  await clearBanners(request);
  const stamp = Date.now();
  const holiday = `หยุดปีใหม่ ${stamp}`;
  const promo = `โปรเช้า ${stamp}`;
  const holidayId = await addBanner(request, { title: holiday });
  await addBanner(request, { title: promo });

  await page.goto(`/v/${SLUG}`);
  await page.getByRole("button", { name: "เข้าสู่ระบบด้วย LINE" }).click();
  await expect(page).toHaveURL(new RegExp(`/v/${SLUG}/home`));

  // Both on screen, in the order the venue arranged them.
  await expect(page.getByText(holiday)).toBeVisible();
  await expect(page.getByText(promo)).toBeVisible();

  // Switched off → gone for customers, still the venue's to bring back.
  await toggleBanner(request, holidayId);
  await page.goto(`/v/${SLUG}/home`);
  await expect(page.getByText(holiday)).toHaveCount(0);
  await expect(page.getByText(promo)).toBeVisible();

  await toggleBanner(request, holidayId);
  await page.goto(`/v/${SLUG}/home`);
  await expect(page.getByText(holiday)).toBeVisible();

  await clearBanners(request);
});

test("the home banner shows the venue's own promotion", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  // Whatever the venue actually runs — never a hard-coded stand-in.
  const promos = await (
    await request.get(`${BASE}/promotions`, { headers: { "X-Venue-Slug": SLUG } })
  ).json();
  test.skip(!promos.data?.length, "venue has no promotions to show");

  await page.goto(`/v/${SLUG}`);
  await page.getByRole("button", { name: "เข้าสู่ระบบด้วย LINE" }).click();
  await expect(page).toHaveURL(new RegExp(`/v/${SLUG}/home`));

  await expect(page.getByText(promos.data[0].title).first()).toBeVisible();
  await expect(page.getByText("โปรโมชั่นลด 10%")).toHaveCount(0);
});

test("the welcome popup greets a customer once per banner", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER, "requires backend (E2E_OWNER=1)");

  await clearBanners(request);
  const title = `ประกาศ ${Date.now()}`;
  const id = await addBanner(request, {
    title,
    message: "เปิดคอร์ทใหม่แล้ววันนี้",
    popup: true,
  });

  await page.goto(`/v/${SLUG}`);
  await page.getByRole("button", { name: "เข้าสู่ระบบด้วย LINE" }).click();
  await expect(page).toHaveURL(new RegExp(`/v/${SLUG}/home`));

  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "เริ่มใช้งาน" }).click();
  await expect(dialog).toHaveCount(0);

  // Dismissed stays dismissed…
  await page.goto(`/v/${SLUG}/home`);
  await expect(page.getByRole("dialog", { name: title })).toHaveCount(0);

  // …until the venue changes the banner, which everyone should see.
  const changed = `${title} (แก้ไข)`;
  await editBanner(request, id, { title: changed });
  await page.goto(`/v/${SLUG}/home`);
  await expect(page.getByRole("dialog", { name: changed })).toBeVisible();

  // A second popup banner is paged through inside the same dialog, not stacked
  // as a second one on top.
  const extra = `ประกาศที่สอง ${Date.now()}`;
  const extraId = await addBanner(request, { title: extra, popup: true });
  await page.goto(`/v/${SLUG}/home`);
  const paged = page.getByRole("dialog");
  await expect(paged).toHaveCount(1);
  // Wait for BOTH slides. Branding is painted from localStorage first and the
  // refetch adds the new banner a moment later; swiping the one-slide version
  // scrolls a strip that does not overflow, which silently does nothing.
  const dots = paged.getByRole("button", { name: /^ประกาศที่/ });
  await expect(dots).toHaveCount(2);

  // Swiping is the gesture a phone offers first — the dots and the button must
  // follow the strip, not only the other way round.
  await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"] .snap-x') as HTMLElement;
    el.scrollBy({ left: el.clientWidth, behavior: "smooth" });
  });
  await expect(paged.getByRole("button", { name: `ประกาศที่ 2` })).toHaveAttribute("aria-current", "true");
  await expect(paged.getByRole("button", { name: "เริ่มใช้งาน" })).toBeVisible();

  // …and the button still pages, for anyone who taps rather than swipes.
  await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"] .snap-x') as HTMLElement;
    el.scrollTo({ left: 0 });
  });
  await paged.getByRole("button", { name: "ถัดไป" }).click();
  await expect(paged.getByRole("heading", { name: extra })).toBeVisible();
  await paged.getByRole("button", { name: "เริ่มใช้งาน" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Popup switched off on both → the cards stay on the page, nothing pops.
  await editBanner(request, id, { popup: false });
  await editBanner(request, extraId, { popup: false });
  await page.goto(`/v/${SLUG}/home`);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(changed)).toBeVisible();

  await clearBanners(request);
});
