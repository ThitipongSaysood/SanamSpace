import { chromium } from "@playwright/test";
const OUT="/private/tmp/claude-502/-Users-sangkazee-sanamspace/175f1959-7be8-458f-a112-f6fb6d5d73fa/scratchpad";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true })).newPage();
await p.goto("http://localhost:3000/owner/login");
await p.locator('input[type="email"]').first().fill("owner@everyday.test");
await p.locator('input[type="password"]').first().fill("password");
await Promise.all([p.waitForURL(u=>!u.pathname.includes("/login"),{timeout:20000}), p.getByRole("button",{name:/เข้าสู่ระบบ/}).click()]);
for (const [route,name] of [["/owner","dash"],["/owner/bookings","bookings"],["/owner/payments","payments"],["/owner/settings","settings"]]) {
  await p.goto("http://localhost:3000"+route); await p.waitForTimeout(2000);
  await p.screenshot({ path: `${OUT}/m-${name}.png` });
  const info = await p.evaluate(() => ({
    url: location.pathname,
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    bodyText: document.body.innerText.slice(0,60).replace(/\n/g," "),
  }));
  console.log(JSON.stringify(info));
}
await b.close();
