import { chromium } from "@playwright/test";
const W = 390, H = 844;                       // iPhone-ish
const b = await chromium.launch();

async function login(page, portal) {
  await page.goto(`http://localhost:3000/${portal}/login`);
  await page.locator('input[type="email"]').first().fill(portal === "admin" ? "super@sanamspace.test" : "owner@everyday.test");
  await page.locator('input[type="password"]').first().fill("password");
  await Promise.all([
    page.waitForURL(u => !u.pathname.includes("/login"), { timeout: 20000 }),
    page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click(),
  ]);
}

async function audit(page, routes, label) {
  console.log(`\n=== ${label} @ ${W}px ===`);
  for (const r of routes) {
    try {
      await page.goto(`http://localhost:3000${r}`, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(1400);
      const m = await page.evaluate(() => {
        const d = document.documentElement;
        const over = d.scrollWidth - d.clientWidth;
        // Which elements stick out past the viewport?
        const bad = [];
        for (const el of document.querySelectorAll("body *")) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.right > d.clientWidth + 1) {
            const tag = el.tagName.toLowerCase();
            const cls = (el.className && typeof el.className === "string" ? el.className : "").slice(0, 45);
            bad.push(`${tag}.${cls}|${Math.round(rect.right)}`);
          }
        }
        return { over, sample: [...new Set(bad)].slice(0, 3) };
      });
      if (m.over > 1) console.log(`  ✗ ${r}  +${m.over}px   ${m.sample.join("  ")}`);
    } catch (e) {
      console.log(`  ! ${r}  ${String(e).split("\n")[0].slice(0, 70)}`);
    }
  }
}

const ownerRoutes = ["/owner","/owner/banner","/owner/billing","/owner/bookings","/owner/branches","/owner/checkin","/owner/courts","/owner/crm","/owner/customers","/owner/membership","/owner/operations","/owner/payments","/owner/promotions","/owner/refunds","/owner/reports","/owner/settings","/owner/staff","/owner/wallet"];
const adminRoutes = ["/admin","/admin/announcements","/admin/billing","/admin/features","/admin/logs","/admin/organizations","/admin/payments","/admin/plans","/admin/refunds","/admin/roles","/admin/settings","/admin/subscriptions","/admin/support","/admin/transactions","/admin/users"];

const o = await (await b.newContext({ viewport:{width:W,height:H}, hasTouch:true, isMobile:true })).newPage();
await login(o, "owner");
await audit(o, ownerRoutes, "OWNER");

const a = await (await b.newContext({ viewport:{width:W,height:H}, hasTouch:true, isMobile:true })).newPage();
await login(a, "admin");
await audit(a, adminRoutes, "ADMIN");

await b.close();
