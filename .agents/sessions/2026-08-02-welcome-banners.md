# 2026-08-02 — Welcome banners: a list, on/off, popup, shown uncropped

_Agent: Claude (Opus 5)_

Two asks, one session:

1. _"แสดงขนาด ตามไฟล์ได้มั้ย ไม่ต้อง crop"_ — show the banner image at the file's own proportions.
2. _"ข้อความต้อนรับ / แบนเนอร์ เปิด/ปิด ได้ เพิ่มได้มากว่า 1"_ — toggle it, and allow more than one.

## What changed

### The single slot became a table

`organization_settings.welcome_title / welcome_message / welcome_image_url / welcome_link /
welcome_popup` → **`welcome_banners`** (`organization_id`, `title`, `message`, `image_url`, `link`,
`is_active`, `popup`, `sort_order`).

The migration **copies the existing banner over and then drops the old columns**. Keeping both would
give the customer app two places to read the same thing from, which is how they drift apart. `down()`
folds the topmost banner back so a rollback does not blank a venue's home page.

`is_active` is the whole point of the request: a seasonal notice gets **parked, not deleted**, so next
year it is switched back on instead of retyped. Delete asks for confirmation and points at the toggle.

### API

| Method | Route | Notes |
| --- | --- | --- |
| GET | `/owner/welcome-banners` | all of them, switched-off included |
| POST | `/owner/welcome-banners` | appended to the bottom |
| POST | `/owner/welcome-banners/reorder` | `{ ids: [...] }` top to bottom |
| PUT | `/owner/welcome-banners/{id}` | |
| POST | `/owner/welcome-banners/{id}/toggle` | show/hide |
| DELETE | `/owner/welcome-banners/{id}` | |

`reorder` is declared **before** `/{id}` so the word "reorder" is not read as an id. Foreign ids in the
`ids` array are **ignored rather than rejected**, so a stale tab cannot reshuffle another venue's list.

`GET /orgs/{slug}/public` now returns `welcomeBanners: [...]` — active only, ordered, and only ones with
actual content. `Organization::welcomeBanners()` scopes `is_active` at the relation so no call site has
to remember.

### Owner UI — a table, not a stack of forms

First pass stacked one full editor per banner. With a 2250px-tall poster in each, reaching the third
banner meant scrolling past two of them — so `/owner/banner` is now a **table**:

`ลำดับ (↑↓)` · `thumbnail` · `หัวข้อ / รายละเอียด` · `Popup` · `สถานะ` · `แก้ไข / ลบ`

- **แก้ไข** opens the full editor in a dialog. Adding a banner drops straight into it — an empty row is
  not the goal.
- **The thumbnail** opens a full-size lightbox. It is the one place a crop is honest: a 56px square is a
  *handle* to the image, not the image, and the lightbox is where an owner confirms the whole poster is
  intact before switching it on.
- Escape closes the lightbox; clicking the image does **not** — that is the thing being looked at.
- Switched-off rows render dimmed, so "ปิดอยู่" reads at a glance without parsing the badge.

### Popup with several banners — swipeable

Several popup-flagged banners become **one dialog** the customer swipes through, never a stack of
dialogs. Dismissal is keyed to the *set* currently flagged, so leaving them alone never nags and adding
or editing one reaches everyone again.

- **CSS scroll-snap, not a drag library.** It is the gesture the phone already knows, keeps momentum and
  rubber-banding for free, and still works with a trackpad or a dot tap. `overscroll-x-contain` stops a
  swipe past the last slide from triggering the browser's back gesture.
- The **CTA and dots live outside the strip**, so the button does not slide out from under a thumb
  mid-swipe. It still reads "ถัดไป" until the last slide, for anyone who taps rather than swipes.
- **With more than one slide the image area is a fixed height.** The strip is as tall as its tallest
  slide, so a portrait poster next to a landscape photo left a dead gap under the shorter one. Still
  `object-contain` — uniform, never cropped. A lone banner keeps its natural height.
- **Escape closes it** (and counts as a dismissal), like any other dialog.

### Uncropped images

The demo banner is **1751×2250** — a portrait poster. `aspect-[16/7] object-cover` was rendering a 2.29
ratio strip out of a 0.778 ratio file, cutting off the "SPECIAL PROMOTION" ribbon at the top and the
"หมดเขต 28/8/69" at the bottom. Measured in-browser, not eyeballed.

- Customer card + owner preview: `block h-auto w-full` → rendered ratio **0.778 == natural 0.778**.
- Popup: `max-h-[60vh] object-contain` — scales a tall poster down to fit, never slices it.
- Owner editor: `max-h-96 w-auto max-w-full` — smaller so the form stays usable, no letterbox, no crop.

Hint text changed from "แนะนำสัดส่วน 16:9 หรือ 16:7" to "แสดงตามสัดส่วนของไฟล์ ไม่ตัดขอบ · แนะนำกว้าง
1200px ขึ้นไป".

## Gotchas worth keeping

- **`TenantBranding` is cached in localStorage.** A customer carrying an older build's copy has no
  `welcomeBanners`, and `.map` on `undefined` would throw before the refetch lands. The restore now
  merges onto `DEFAULT` — worth doing for *every* future field, not just this one.
- **`BannerCard` deliberately has no re-sync effect.** The list keys each card by banner id, so a
  reorder shuffles component instances rather than feeding one card another banner's values; half-typed
  edits survive it. An effect here would also have tripped `react-hooks/set-state-in-effect`.
- The three earlier `2026_08_02_*` welcome migrations are **still uncommitted** and now add columns that
  the new one immediately drops. Harmless (the carry-over guards on `Schema::hasColumn`, and 181 tests
  prove a from-scratch run), but they could be collapsed into one before shipping.

## Verified

backend **181/181** · tsc clean · vitest **24/24** · lint **13 = baseline** · e2e **28/29**

New backend coverage (`OwnerWelcomeBannerApiTest`, 7 tests): several banners reach the public payload in
order · toggle hides without deleting and comes back · reorder changes what customers see first · popup
is per-banner · an empty banner is not shown · cross-tenant read/update/toggle/delete all 404 · reorder
ignores foreign ids.

New e2e: `a venue can run several banners and switch one off`; the popup spec now also proves two flagged
banners page inside **one** dialog. `owner-banners.spec.ts` covers the table itself — add → editor opens →
save → row appears → reopen shows the saved values → toggle parks it without removing the row → delete —
and asserts the lightbox is `object-contain` with **rendered ratio == natural ratio**.

**Trap:** Playwright's `locator.count()` does **not** auto-wait. Counting rows before the query resolved
returned 0 and made a "one more row" assertion pass against an empty table; wait on `tbody` (or the empty
state) first.

**Trap:** the popup swipe test failed intermittently for a reason worth remembering — branding paints
from **localStorage first** and the refetch adds the new banner a moment later. Scrolling the one-slide
version scrolls a strip that does not overflow, which **silently does nothing**. Wait for both dots
before swiping.

**Trap:** `booking.spec.ts` dismissed the popup by clicking "เริ่มใช้งาน", which is labelled "ถัดไป"
whenever more than one announcement is flagged — so a banner left behind by another spec broke it. It
presses Escape now, which closes regardless of how many there are.

### `venue-isolation.spec.ts` was a time bomb, now defused

`a venue's app shows only that venue` asserted `getByText("Chic Badminton Club")`. That string was only
ever on the home page **inside the upcoming-booking card** — so the test passed at 12:30 and failed at
13:45, because the seeded 10:00–13:00 booking had simply ended. Nothing to do with tenant isolation.
Confirmed by comparing two runs an hour apart against the same code.

Rewritten to read both venue names from `/orgs/{slug}/public` (a rename can no longer turn it into a test
of nothing) and to anchor on the header wordmark. `BrandLogo` splits `logoText` on the first space into
two elements, so `getByText(/chic badminton club/i)` matches **nothing** — the parent holds
"CHIC" + "BADMINTON CLUB" with no separator. Two `exact` checks instead.

## Still open

- Nothing committed. **184 files changed**, migrations pending (`composer install` + `php artisan migrate`).
- Pre-existing `admin.spec.ts` "MRR" locator failure — not a regression, confirmed earlier by stashing.
- Pre-existing `composer audit`: 9 advisories in `guzzlehttp/guzzle` 7.11.1 + `psr7`, predating this work.
