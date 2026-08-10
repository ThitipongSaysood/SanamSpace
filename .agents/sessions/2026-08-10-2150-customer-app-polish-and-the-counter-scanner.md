# 2026-08-10 21:50 — Testing on a real phone: the customer app, and turning a staff phone into the scanner

A short session driven entirely by holding the product in a hand instead of a browser tab. Almost
everything found here was invisible on a desk: a scanner that could not open a camera, a total the
scrollbar sat on top of, a status the customer had to pull-to-refresh to see.

## Goal

Open the customer app on a real phone, then follow whatever that turned up.

## What was actually done

### The customer app on a device

- **The blocker was not login — it was Next.** Opened from a phone at `http://192.168.1.182:3000`,
  Next answered **403 to every `_next/static/chunks/*` file**: it blocks cross-origin requests to
  dev assets by default. The HTML rendered, no JavaScript arrived, and the app sat on the sport
  loader forever with nothing on screen to say why. Fixed with `allowedDevOrigins` scoped to the
  RFC1918 ranges rather than `*`.
- **Development now serves the API same-origin, like production.** `next.config.ts` proxies
  `/api/*` and `/storage/*` to Laravel, and `.env.local` goes back to `NEXT_PUBLIC_API_URL=/api/v1`
  — the value production already uses behind nginx. Development was the odd one out, and it cost:
  the LAN address had to be pasted into `.env.local` and changed again whenever the Wi-Fi did, and
  an https dev server could not have called an http API at all (mixed content).
- **`?autologin=1`** for demoing on a device, fenced three ways: development builds only (`NODE_ENV`
  is inlined, so the branch is dead code in a production bundle), opt-in per URL, and only where the
  venue has no LIFF channel. Verified both directions in isolated browser contexts — with the flag
  it lands on `/home`, without it still bounces to the login screen.
- **Check-in status updates itself.** The scan happens on somebody else's device, so the customer
  used to stare at a live-looking QR that had already been used; the screen only caught up seven
  minutes later when they refreshed by hand. It now polls every 5s while waiting, stops the moment
  the booking comes back checked in, and pauses when the tab is not focused. Polling rather than a
  socket: the wait is a couple of minutes at a counter, against no new infrastructure.
- **The booking page's scrollbar sat on the total.** Hidden on the customer surface only — owner and
  admin are desktop screens with long tables, where the scrollbar is the only thing saying how much
  list is left. Worth recording that this one could **not** be reproduced locally (measured
  scrollbar width 0, no horizontal overflow); on Android the scrollbar is drawn over the page, which
  matches the report exactly.

### The counter's scanner

- **`/scan`** — the same scanner, outside the owner layout: full-bleed camera, one large result,
  nothing else to press. Same `POST /owner/scan` endpoint, so the permission rules are identical. A
  different doorway, not a different set of keys.
- **Installable**, with its own manifest at `/scan/manifest.webmanifest`. **I broke this first and
  had to undo it**: I wrote the scanner manifest over `app/manifest.ts`, which is the CUSTOMER app's
  — a customer tapping "add to home screen" would have installed the staff scanner. Next's file
  convention allows one manifest, so the scanner gets its own URL and a `<link rel="manifest">` from
  a layout instead.
- **Not a sidebar entry.** Installing happens once; a menu is for what you press daily. It lives on
  the check-in screen as a fold-out card with a QR — the setup has to happen on a *different* device
  from the one reading the instructions, and typing a LAN address into a phone keyboard is where
  this otherwise falls apart.
- **The camera cannot work over http, and now says so.** `getUserMedia` needs a secure origin; on an
  http LAN address `navigator.mediaDevices` is undefined. The old message read "อนุญาตการใช้กล้องใน
  เบราว์เซอร์", sending staff to hunt for a permission that was never the problem. It now names the
  real cause and separates the four cases (insecure origin / denied / no camera / camera busy), and
  the type-the-code box opens by itself when the camera cannot be offered at all. Production is
  https, so the camera works there with no further change.
- **The aiming frame was a fixed 192px**, a small square in the middle of a laptop feed, implying the
  QR had to fit inside it — decoding runs on the whole frame. Now 70% of the preview.

### Owner settings

- **The page used a third of a desk monitor.** Every tab is a grid now; the payment tab is split into
  the two things it actually configures — the PromptPay QR the system generates, and the bank
  account a customer transfers to by hand and uploads a slip for. They were one card called
  "บัญชีรับเงินของสนาม", which read as a single setting.
- **The save button had three sizes, three positions and two labels** across four tabs, including one
  buried inside a card instead of under its form. One shared `SaveRow` now, with a fixed minimum
  width so the button does not resize under the finger when the label changes to "กำลังบันทึก...".
- **Six three-colour theme presets**, and — the actual bug — **the swatch circles now set all three
  colours, not only the primary.** สีรอง and สีเน้น could previously only be changed through the
  native colour picker, the slowest way to choose a colour, which is why the demo venue's secondary
  was still identical to its primary and every banner gradient rendered flat.

### Two e2e specs that were failing before this session

Both came from `d1a24cb`, confirmed by stashing this session's changes and watching them fail
identically. Neither was an application fault:

- `staff-support` waited for a `window.alert` that the portal no longer raises — it moved to toasts.
  The spec failed while the behaviour it guards worked fine.
- `customer-merge` released its booked slot only on the happy path, so the first failure for any
  other reason left 07:00 taken and every later run failed on the clash instead of on the real
  problem. Now released in a `finally`, and the stale row cleared.

A third, `owner-customer-detail`, was failing because two migrations from `d1a24cb` had never been
run locally — the same reason `/owner/line-templates` was answering "เกิดข้อผิดพลาด".

## Status at close

🟢 **All green.** backend **623/623** · tsc **clean** · vitest **31/31** · eslint **0 errors** ·
e2e **44/44** (the two long-standing failures fixed).

🔴 **Deploy still blocked** — `DEPLOY_PATH` on the server. Production is still running the broken
credit system.

## Next steps

1. **Deploy.** Unchanged and still first.
2. **The bottom nav still uses only the primary colour.** Buttons and banners use all three; the nav
   tints its active icon and nothing else. Left alone deliberately — three colours in a navigation
   bar usually reads worse, not better — but the settings copy claims the whole app, so either the
   nav or the copy should move.
3. **Camera on a phone in development** needs https: a tunnel, or a certificate covering the LAN
   address. Deferred — the typed-code path covers it, and production is https anyway.
4. **`storage_gb`** is still the one plan limit with nothing behind it.
