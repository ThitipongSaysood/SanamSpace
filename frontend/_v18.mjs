import { chromium } from "@playwright/test";
const OUT="/private/tmp/claude-502/-Users-sangkazee-sanamspace/175f1959-7be8-458f-a112-f6fb6d5d73fa/scratchpad";
const b = await chromium.launch();
const NAV = { timeout: 120000 };
const p = await (await b.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true })).newPage();
p.on("console", m => { if (m.type()==="error") console.log("ERR:", m.text().slice(0,120)); });
await p.goto("http://localhost:3000/v/everyday-badminton", NAV);
await p.getByRole("button", { name: "เข้าสู่ระบบด้วย LINE" }).click();
await p.waitForURL(/\/home/); await p.waitForTimeout(2000); await p.keyboard.press("Escape");
await p.goto("http://localhost:3000/v/everyday-badminton/settings", NAV); await p.waitForTimeout(2000);

const sw = p.getByRole("switch").first();
console.log("before:", await sw.getAttribute("aria-checked"));
await p.screenshot({ path: `${OUT}/c-on.png` });

await sw.click(); await p.waitForTimeout(1500);
console.log("after tap:", await sw.getAttribute("aria-checked"));
await p.screenshot({ path: `${OUT}/c-off.png` });

// does the server agree?
const t = await p.evaluate(() => window.localStorage.getItem("sanamspace.token"));
const state = await p.evaluate(async (tk) => (await (await fetch("http://localhost:8000/api/v1/me/consent",{headers:{Authorization:`Bearer ${tk}`,Accept:"application/json","X-Venue-Slug":"everyday-badminton"}})).json()).data, t);
console.log("server:", JSON.stringify(state));

// reload: does it stick?
await p.reload(); await p.waitForTimeout(2000);
console.log("after reload:", await p.getByRole("switch").first().getAttribute("aria-checked"));
await b.close();
