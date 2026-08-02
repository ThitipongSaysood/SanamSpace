import { test, expect } from "@playwright/test";

/**
 * Each venue rents its own app: the customer opens /v/{their-slug} and must
 * never see, or be able to reach, another venue's data from inside it.
 */

const BASE = "http://localhost:8000/api/v1";

test("a venue's app shows only that venue", async ({ page, request }) => {
  // Both names come from the API rather than being hard-coded, so renaming a
  // venue cannot silently turn this into a test of nothing.
  const mine = await (await request.get(`${BASE}/orgs/everyday-badminton/public`)).json();
  const theirs = await (await request.get(`${BASE}/orgs/tsr-arena/public`)).json();

  await page.goto("/v/everyday-badminton");
  await page.getByRole("button", { name: "เข้าสู่ระบบด้วย LINE" }).click();
  await expect(page).toHaveURL(/\/v\/everyday-badminton\/home/);

  // Anchored on the header wordmark, which is always on screen. This used to
  // look for the venue name inside the upcoming-booking card, so it started
  // failing the hour that booking ended — nothing to do with tenant isolation.
  // BrandLogo splits the wordmark across two elements, hence the two checks.
  const [first, ...rest] = (mine.logoText as string).split(" ");
  await expect(page.getByText(first, { exact: true }).first()).toBeVisible();
  if (rest.length) {
    await expect(page.getByText(rest.join(" "), { exact: true }).first()).toBeVisible();
  }

  await expect(page.getByText(theirs.name as string)).toHaveCount(0);
});

test("every customer request is scoped to the venue in the URL", async ({ page }) => {
  const slugs = new Set<string>();
  page.on("request", (req) => {
    const slug = req.headers()["x-venue-slug"];
    if (req.url().includes("/api/v1/") && slug) slugs.add(slug);
  });

  await page.goto("/v/tsr-arena");
  await page.getByRole("button", { name: "เข้าสู่ระบบด้วย LINE" }).click();
  await expect(page).toHaveURL(/\/v\/tsr-arena\/home/);

  expect([...slugs]).toEqual(["tsr-arena"]);
});

test("the platform root is not a venue", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/landing/);
});

test("an unknown venue link is rejected", async ({ page }) => {
  await page.goto("/v/no-such-venue");
  await expect(page.getByText("ไม่พบสนามนี้")).toBeVisible();
});
