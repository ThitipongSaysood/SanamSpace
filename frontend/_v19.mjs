import { chromium } from "@playwright/test";
const OUT="/private/tmp/claude-502/-Users-sangkazee-sanamspace/175f1959-7be8-458f-a112-f6fb6d5d73fa/scratchpad";
const NAV = { timeout: 120000 };
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:1360,height:950} })).newPage();
p.on("console", m => { if (m.type()==="error") console.log("ERR:", m.text().slice(0,120)); });
await p.goto("http://localhost:3000/owner/login", NAV);
await p.locator('input[type="email"]').first().fill("owner@everyday.test");
await p.locator('input[type="password"]').first().fill("password");
await Promise.all([p.waitForURL(u=>!u.pathname.includes("/login"),{timeout:60000}), p.getByRole("button",{name:/เข้าสู่ระบบ/}).click()]);

await p.goto("http://localhost:3000/owner/broadcast", NAV); await p.waitForTimeout(3000);
const note = await p.getByText(/ขอไม่รับข่าวโปรโมชั่น/).first().textContent().catch(()=>null);
console.log("broadcast suppression note:", note?.trim() ?? "(none shown)");
await p.screenshot({ path: `${OUT}/c-broadcast.png` });

await p.goto("http://localhost:3000/owner/customers", NAV); await p.waitForTimeout(2500);
await p.locator('a[href^="/owner/customers/"]').first().click();
await p.waitForTimeout(2500);
const badge = await p.getByText(/ยินยอมรับข่าวสาร|ขอไม่รับข่าวโปรโมชั่น|ยังไม่ได้ถาม/).first().textContent().catch(()=>null);
console.log("customer consent badge:", badge?.trim() ?? "(none)");
await p.screenshot({ path: `${OUT}/c-customer.png` });
await b.close();
