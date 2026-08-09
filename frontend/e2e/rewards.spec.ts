import { test, expect } from "@playwright/test";
import jsQR from "jsqr";

const VENUE = "everyday-badminton";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1";

/** Give the customer enough points to redeem, through the owner's own endpoint. */
async function topUpPoints(request: import("@playwright/test").APIRequestContext, memberNo: string) {
  const login = await request.post(`${API}/auth/admin/login`, {
    data: { email: "owner@everyday.test", password: "password" },
  });
  const token = (await login.json()).token as string;
  const headers = { Authorization: `Bearer ${token}`, "X-Venue-Slug": VENUE };

  const list = await request.get(`${API}/owner/memberships`, { headers });
  const rows = (await list.json()).data as { id: string; memberId: string }[];
  const membership = rows.find((r) => r.memberId === memberNo);
  if (!membership) throw new Error(`no membership ${memberNo}`);

  await request.post(`${API}/owner/memberships/${membership.id}/points`, {
    headers,
    data: { delta: 200, note: "e2e: ทดสอบแลกของรางวัล" },
  });
}

// The owner half needs the real backend, same as the other owner specs.
test.skip(!process.env.E2E_OWNER, "requires backend + NEXT_PUBLIC_API_URL (run with E2E_OWNER=1)");

/**
 * Redeeming from the app, and collecting it at the counter.
 *
 * The QR is the part worth a browser: it is generated from the collection code
 * at render time, and a decorative one would be worse than none — staff would
 * scan it and nothing would happen. So this decodes the rendered pixels with
 * the same library the counter's scanner uses.
 */
test("a reward redeemed in the app is collected at the counter", async ({ page, request }) => {
  await page.goto(`/v/${VENUE}`);
  await page.getByRole("button", { name: "เข้าสู่ระบบด้วย LINE" }).click();
  await expect(page).toHaveURL(new RegExp(`/v/${VENUE}/home`));
  const welcome = page.getByRole("dialog");
  if (await welcome.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await expect(welcome).toHaveCount(0);
  }

  await page.goto(`/v/${VENUE}/membership`);
  await expect(page.getByRole("heading", { name: "แลกของรางวัล" })).toBeVisible();

  // Top the balance up first: every run spends points, so a spec that assumed a
  // balance would pass once and then fail forever.
  const memberNo = await page.getByText(/^SM-\d+$/).innerText();
  await topUpPoints(request, memberNo.trim());
  // Wait for the list of what is already waiting to land before counting it —
  // counting mid-flight reads 0 and turns the next assertion into a race.
  const loaded = page.waitForResponse((r) => r.url().includes("/me/redemptions"));
  await page.reload();
  await loaded;

  // Anything already waiting to be collected from an earlier run: this counts
  // the change, not the total.
  const waiting = page.getByRole("img", { name: /QR รหัสรับของ/ });
  const before = await waiting.count();

  const redeem = page.getByRole("button", { name: "แลก" }).and(page.locator("button:enabled")).first();
  await redeem.click();

  // Tapping "แลก" must not spend anything on its own — points leave the account
  // only after a deliberate slide.
  const sheet = page.getByRole("dialog", { name: "ยืนยันการแลกของรางวัล" });
  await expect(sheet).toBeVisible();
  await expect(waiting).toHaveCount(before);

  const slider = sheet.getByRole("slider");
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + 24, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 8, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();

  await expect(waiting).toHaveCount(before + 1);

  // The QR must encode the code itself — a decorative one is worse than none,
  // because staff would scan it and nothing would happen.
  const qr = waiting.first();
  await expect(qr).toBeVisible();
  const alt = await qr.getAttribute("alt");
  const code = alt!.replace("QR รหัสรับของ ", "").trim();
  expect(code).toMatch(/^R[A-Z0-9]{5}$/);

  // Decode it the way the counter's camera does — same library, same pixels.
  const frame = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src!;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { data: Array.from(data.data), width: data.width, height: data.height };
  }, await qr.getAttribute("src"));

  const found = jsQR(Uint8ClampedArray.from(frame.data), frame.width, frame.height);
  expect(found?.data).toBe(code);

  // Home carries it too: the venue takes an uncollected reward back, so the
  // customer has to be reminded before the deadline rather than after it.
  await page.goto(`/v/${VENUE}/home`);
  await expect(page.getByRole("heading", { name: "ของรางวัลที่รอรับ" })).toBeVisible();
  await expect(page.getByText(code, { exact: true })).toBeVisible();

  // The counter. Typed rather than scanned because a headless browser has no
  // camera — the scanner hands the very same string to the very same endpoint.
  await page.goto("/owner/login");
  await page.locator('input[type="email"]').fill("owner@everyday.test");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/owner$/);

  // The one scan screen: staff do not have to know it is a reward code.
  await page.goto("/owner/checkin");
  await page.getByLabel("พิมพ์รหัส").fill(code);
  await page.getByRole("button", { name: "ตรวจสอบ" }).click();

  await expect(page.getByText("จ่ายของรางวัลเรียบร้อย")).toBeVisible();
  await expect(page.getByText("ของรางวัล", { exact: true })).toBeVisible();

  // And it has left the queue rather than lingering as still owed.
  await page.goto("/owner/points");
  await expect(page.getByRole("heading", { name: "รอลูกค้ามารับ" })).toBeVisible();
  await expect(page.locator("li span.font-mono", { hasText: code })).toHaveCount(0);
  await page.screenshot({ path: "/tmp/ss-scan-done.png", fullPage: true });
});
