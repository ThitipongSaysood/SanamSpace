# Session 2026-08-15 17:40 — white-label customer surfaces, per-branch owner scope, security-scan skill

## Goal
User-driven, one request at a time, all of it circling the same question: **which parts of this product
still look like ours instead of the venue's, and which parts of the owner portal still assume one branch.**

1. Make the customer login page belong to the venue that rents the system.
2. Fix the admin venue drawer, which was unusable for editing.
3. Give a multi-branch venue a way to see one branch at a time — bookings and dashboard.
4. Rework the customer booking screen's pickers.
5. Review, fix and install a third-party `web-security-scan` skill; then split it into its own repo.

## What changed
**8 commits `1e13169`→`a54c714`, pushed to `main`.** 43 files, +2208 / −257.

- **`feat(app)` 1e13169 — the venue's own login page.** Migration adds `login_cover_url` +
  `login_tagline`; `GET /orgs/{slug}/public` carries them as `coverUrl`/`tagline`, `PUT /owner/settings`
  accepts them, new "หน้าเข้าสู่ระบบ" tab in owner settings with a live preview. New
  `components/court-backdrop.tsx` draws the court of the venue's OWN sport behind the card when it has
  uploaded no photo — line art in the venue's colour, not stock photography. The page also joined the
  bilingual pass it had been missed by on 08-13, and the hard-coded shuttlecock for a venue with no logo
  became that venue's sport, then its initials.
- **`refactor(admin)` 20ef68c — a venue is a page, not a 380px drawer.** `_drawer.tsx` → `_detail.tsx`,
  new route `/admin/organizations/[id]`, i18n namespace `admin.orgDrawer` → `orgDetail` (five keys the
  redesign orphaned were deleted). The drawer was a flex sibling of the table, so the table lost its last
  three columns to make room for a slot that had to hold five tabs and four LINE credential fields.
- **`feat(owner)` acf88f4 — one branch at a time, or all of them.** New `BelongsToBranch` trait
  (`forBranch(null)` = ทุกสาขา and leaves the query untouched, so the combined view is the query it
  always was). `GET /owner/dashboard` + `/owner/bookings` take `branchId`, resolved through the org's own
  branches so a foreign id is a **404, not an empty list that reads like a quiet day**. The header
  "Everyday Badminton" button turned out to be **wired to nothing** — same hard-coded text for every
  account — and is now a real switcher that only appears above one branch.
- **`feat(app)` a33a219 — branch and court pickers became tiles**, the same tile as the hour picker
  below them. The court spec moved under the grid and describes only the selected court.
- **`fix(app)` e7f72b5 — court photos actually appear.** Both screens showing a court called
  `SportMedia` directly and never read `imageUrl`, which the owner portal has been collecting all along.
- **`chore(tools)` e47ddcc + 89a3e73 — the security skill**, reviewed, fixed, then moved out to its own
  repo (see below).
- **`feat(app)` a54c714 — the first-entry loader** wears the venue's name and colour instead of ours.

## Decisions worth keeping
- **Venue-wide figures stay venue-wide.** `totalCustomers`, `newCustomersToday`, `walletBalance` do not
  follow the branch scope — a customer and their credit belong to the venue, not the branch they last
  played at — and the cards append "· ทั้งสนาม" rather than letting a branch view imply otherwise.
- **null is a designed state on the login page**, not a gap: no cover → draw the venue's sport; no
  tagline → write one from its name. It has to survive the whole path, which is why the public endpoint
  does `?: null`.
- **Not built, deliberately:** the reference sheet for the login page showed phone login, email login and
  สมัครสมาชิก. None exist in the backend — customer auth is LINE-only and those buttons were removed on
  purpose on 08-14. Re-adding them is an auth feature, not a UI change.
- **Not scoped to branch yet** (nobody asked, each needs its own thought): ศูนย์ปฏิบัติการ, ตรวจสลิป,
  ลูกค้า, POS, เช็คอิน. The switcher is global, so these currently ignore it.

## The security-scan skill — 8 bugs, half of them only visible when run
The user supplied `web-security-scan.skill` and asked for a review. Its own rule was "ตรวจไม่ได้ ≠ ผ่าน";
it broke that rule eight ways. Four were visible by reading, four only appeared when it was pointed at
real code:

1. `timeout` is GNU coreutils and absent on macOS → every openssl probe failed → the empty result scored
   as a **PASS on item 1**, the highest-risk line in a 189-item checklist.
2. OpenSSL 3.x refuses to *offer* TLS 1.0/1.1, so the server is never asked; that silence also passed.
3. "File exposed" rested on a bare 200 — a soft-404 site produced 36 invented Criticals.
4. `curl -w '%{http_code}' || echo 0` → `"0000"` on an unreachable host (curl prints 000 AND exits
   non-zero): invalid JSON, whole run died. Same shape in `grep -c … || echo 0` → `"0\n0"`, which
   **inverted** the directory-listing verdict.
5. `npm audit` exits non-zero *when it finds something* — the normal case — so `|| echo null` appended to
   good JSON: any project with a vulnerability could not be scanned at all.
6. An unreachable host still produced findings about headers never received.
7. The secrets grep was mapped to item 113 (CORS) — wrong subject, and it understated Critical → High.
8. That finding reported a count and no filenames, so a fixture in a test file read as a leaking key.

Then, on request, the report became a **single self-contained HTML page** (filter + search + print) with
`.xlsx` kept for handing work out, and the skill moved to its own repo so it can be shared:
`github.com/ThitipongSaysood/claude-skills` (pushed; **currently private** — must be made public before
anyone else can install it). Installed copy lives at `~/.claude/skills/web-security-scan/`.

**Its findings on this codebase** (local code only — no domain was scanned, so 184/189 = ยังไม่ตรวจ):
frontend npm high×4 with fixes available; backend npm critical×2 high×2, all dev-only vite tooling;
one "secret" that is a test fixture. `npm audit fix` on both stacks is the only real action.

## Verification
Backend **732/732** (3,362 assertions) · frontend unit **65/65** · e2e **44/44** · tsc + eslint clean.
Every UI change was checked in a real browser at 390px/1440px, not just typechecked.

## State at end
Green and pushed. Working tree clean apart from generated scan reports, which `.gitignore` now excludes.

## Next step
- `npm audit fix` in `frontend/` and `backend/` — the only actionable finding from the scan.
- Make `ThitipongSaysood/claude-skills` public if it is meant to be shared; the skill now lives in two
  places (`~/.claude/skills/` and that repo) and will drift unless one becomes a symlink.
- The booking detail screen still hard-codes `sport="badminton"` for the court it is about; fixing it
  needs the booking payload to carry the court's sport and photo.
- Still open from before: P3 launch/ops (Sentry, monitoring, backup verify); `.codex/agents/*.toml` name
  routes that no longer exist; `docs/pricing.md` disagrees with the `plans` table.
