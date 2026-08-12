# Session 2026-08-12 ~21:30 — one demo venue per plan, branches reach the customer app, double-payment on Back

Baseline at close: backend **678/678** (2,966 assertions) · e2e **44/44** · vitest **43/43** · tsc clean ·
eslint **0 errors**. 5 commits, `b72dc61` → `ee95158`. Committed + pushed to `main`.

The session started as "reset the demo data". Almost everything below is something that reset exposed: the
demo had been one branch per venue since the beginning, and a great deal of code had quietly been written
against that.

## What was done

### 1. Demo data: one venue per plan tier (`44b9565`)
Two venues, both one branch with a handful of courts — so opening Starter and Pro side by side showed the
same picture. A demo that cannot tell ฿990 from ฿3,990 cannot be used to sell either.

| plan | venue | shape | plan's ceiling |
|---|---|---|---|
| Pro | `everyday-badminton` | 2 branches / 10 courts | ∞ |
| Business | `tsr-arena` | 3 branches / 9 courts | 3 / 30 |
| Starter | `badhall-ladprao` (new) | 1 branch / 4 courts | 1 / 10 |

Deliberately **under** each ceiling: a venue sitting exactly on its cap cannot demonstrate what happens when
you add one more, which is the other half of what the limits are for. Everyday Badminton keeps its original
branch and its six courts untouched — its whole customer history hangs off them, and so does most of the
suite. Every venue now has an owner login (`owner@tsr.test`, `owner@badhall.test`); two of the three had none
and could not be opened at all.

**Two things the product ships and the seeder never created:**
- **Rewards.** The rewards screen, the redemption QR and the counter's collection flow were all built,
  tested and shipped against rows that existed only because somebody had made them by hand in the dev
  database. One of each type now — and a **product** behind the product reward, without which the app renders
  it "ของหมด" and the button is dead.
- **Points.** The venue seeds memberships and a points ledger but had the programme switched off, which hides
  all of it. `self_redeem_enabled` stays **off** deliberately: `RewardTest` asserts the app is refused until a
  venue opts in.

**Three e2e specs had been passing on ambient state.** `checkin.spec` skipped ITSELF ("no confirmed booking to
check") the moment the database was reset — quieter than failing, so nobody noticed. They make the booking
they need now. `rewards.spec` likewise sets the two flags it depends on instead of assuming them.

Test expectations that hard-coded the fixture's size now derive it. Not an accommodation: "the demo venue has
6 courts" was never what any of them was testing — the dashboard agreeing with the database is.

**Reverted on purpose:** seeding a week of bookings for the demo customer. It broke 11 tests that assume the
venue starts empty and then create their own bookings in slots that clashed. That assumption is reasonable and
long-standing; the dashboard and operations board stay empty until real bookings exist. `DemoBookingsSeeder`
already exists for when a populated venue is wanted.

### 2. Booking: pick a branch, then that branch's courts (`d735bec`)
The customer's booking screen listed every court the venue owned as one flat list, with nothing saying where
any of them were — and branches are different places to drive to.

The payloads could not have said either. `VenueResource.id` is the organization slug, so a two-branch venue
returned two rows under one id with nothing to tell them apart; a court named only its venue. Both carry the
branch now (`branchId`, plus `branchName` on a court). `id` is unchanged, so nothing that reads a venue by
slug moved.

The step appears **only when there is more than one branch** — a venue with one is not making a choice, and
must not grow a picker with a single option. Changing branch clears the selected court, which belonged to the
branch just left.

### 3. Every venue link goes to the branch it was tapped on (`d9bb596`)
Same root cause, other screens. Two cards, both to `/venue/<slug>`, and whichever branch that page resolved
was not the one tapped — same name on the card, different place on screen. Cards, the detail page's own
sub-links and the home shortcut use `branchId` now. "ข้อมูลสนาม" is about ONE place, so with several branches
it asks which first. Booking from home no longer detours through search: the booking screen asks now.

### 4. 🔴 Going Back after sending a slip asked for the money again (`ee95158`)
Reported from the app, and real. Pay → upload slip → open the booking → press Back, and the full payment form
returns as if nothing had been sent. The customer's own next step is to pay twice.

The screen kept the payment in local state (`useState<Payment | null>(null)`), so every guard on it —
approved, pending_review — held only for as long as that one mount lived. Coming back re-mounted it empty and
fell straight through to the form, while the server had known since the upload. It reads
`booking.paymentStatus` now, with the local value only as the faster copy for the moment just after acting.

Reproduced **before** the change (Back showed "ชำระเงิน") and after (Back shows "ส่งสลิปแล้ว"); the two new
tests were confirmed to fail on the old page.

### 5. Codex agent definitions tracked (`b72dc61`)
`.codex/agents/{Admin,App,Owner}.toml`, committed as written. Their scopes and baselines predate the
multi-tenant restructure — see Next step.

## Decisions worth remembering

- **The demo is sized by plan, not by convenience.** If Pro looks smaller than Business the demo argues
  against the price list.
- **A spec that needs state must set it.** Three specs and one seeder gap were hidden for weeks because the
  shared dev database happened to carry the leftovers. `migrate:fresh` is the only honest test of a spec.
- **A skipped test is not a passing test.** `test.skip(!booking, …)` reported green while testing nothing.
- **Screen state is not payment state.** Anything that decides whether to take money must read the server.

## State at end

Green across the board (numbers at the top). Dev database freshly seeded; `everyday-badminton` back to
`["badminton"]` and no `BKDEMO` rows left.

## Next step

- **Trial signup is not wired** (investigated, user deferred): the landing CTA is `href="#line"` — a dead
  anchor on all four buttons. Worse, **a venue owner created from the admin screen can never log in**: the
  password is `Str::random(24)`, never sent, and there is no invite, no set-password and no forgot-password
  anywhere. And "30 วัน" has two paths — creating a venue with a plan sets `ends_at` +30 days but not
  `trial_start_at`/`trial_end_at`, so the system does not record it as a trial at all.
- **Double payment is still possible from a second tab** held open from before the slip was sent. The durable
  fix is the backend refusing to create a payment while one is `pending_review`.
- `.codex/agents/*.toml` describe `frontend/app/(app)/**` and `(auth)/**`, which no longer exist, and quote
  baselines of 87/22 against today's 678/43.
- Deploy still blocked (`DEPLOY_PATH` missing); production still runs the pre-fix credit system.
- `docs/pricing.md` still disagrees with the `plans` table (the table bills, so it wins).
- Platform surfaces (admin, landing, login) still fall back to 🏸 on toasts.
