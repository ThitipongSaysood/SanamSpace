# Session 2026-08-07 ~18:00 — Broadcast feature, banner images, UI/UX polish, login root-cause

Follows 2026-08-07-1430 (audit risks #1/#3/#6/#7) and 2026-08-07-1600 (#2 expiry + #4 Broadcast v1 + login
message fix). This checkpoint covers the Broadcast feature build-out, banner images, the wizard UI redesign,
the real login root-cause, and motion.

## Goal
Turn the Broadcast scaffold into a real "ยิงโปร" tool the owner enjoys using, and unblock the owner/admin
login the user kept hitting.

## What was done

### Login — real root cause (the 404)
- Owner/admin login 404'd because **`frontend/.env.local` didn't exist** → `NEXT_PUBLIC_API_URL` empty →
  owner/admin API layer posts to the Next origin (:3000), not Laravel (:8000). Created `.env.local` with
  `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`. (Earlier in the day I'd only fixed the *message* for
  429/422 — necessary but not the cause.) Verified: `:3000/auth/admin/login` → 404, `:8000/...` → 200.
- Recorded both gotchas as permanent rules in `.agents/AGENTS.md` (env + storage:link + 402-subscription).

### Broadcast feature (Owner `/owner/broadcast`, closes #4)
- **Channels**: `line` (multicast over the venue's `line_messaging_token` via `LineMessagingService`) or
  `app` (in-app promo notification via `NotificationService::promo`). No token → recorded, `delivery.noToken`.
- **Audiences** from booking history: lost / regulars / one_time / new / all / segment
  (`broadcasts.audience` + `inactive_days`; `GET /owner/broadcasts/audience-preview` → recipient/reachable).
- **Message templates** (5 presets, frontend), **live phone-mockup preview**, and a **banner image**:
  client-side downscale to JPEG (`downscaleImage`) → `ownerApi.uploadImage` → shown in the LINE bubble / app
  card preview and stored on the broadcast (`broadcasts.image_url`) + the notification (`notifications.image_url`).
  LINE sends an image message ahead of the text; the customer bell renders the banner.
- **UI**: rebuilt as a **3-step wizard** (ช่องทาง → ข้อความ → ส่ง) with a live summary bar, and — after send
  — a full **"ส่งสำเร็จ" success screen** (big check, count, "ยิงโปรใหม่" reset). Uses the app's own design
  system (loaded the `artifact-design` skill to calibrate). Phone preview grows with content so long text
  isn't clipped.
- **Customer app**: notifications page → tap a card opens a **detail bottom-sheet** (full text + big image),
  image taps into the shared `ImageLightbox`. Mobile safe-area padding + `dvh`.
- **Motion**: `tw-animate-css` entrance animations (modals, cards, wizard steps, lightbox) + a global
  `prefers-reduced-motion` guard in `globals.css`.

### Backend
New: `Services/LineMessagingService.php`, `config/broadcast.php`, migrations
`add_audience_to_broadcasts` + `add_image_to_broadcasts_and_notifications`. Changed: `Owner/BroadcastController`
(audiences, channels, preview, image), `NotificationService::promo(+image)`, `OwnerBroadcastResource` /
`NotificationResource` (+imageUrl/audience/delivery), `Broadcast` casts, `config/services.php` (line.push_url).
Tests: `BroadcastLineTest` 7/7 (LINE multicast incl. image message via `Http::fake`, in-app promo, no-token,
audience presets) + `NotificationServiceTest`.

## State at end
Local green: backend **244/244** · tsc clean · vitest 24/24 · lint 13 (= baseline). **Not committed.**
Live-smoked LINE (`noToken` in dev) and in-app (`sent`, promo notification with image_url) on the server.

## Gotchas discovered
- **`php artisan storage:link` was missing** → uploads succeed but images 404 (broken icon). Ran it.
- Backend `NotificationService`/`LineMessagingService` are new classes — needed `composer dump-autoload`
  when tests said "class does not exist" under the optimized classmap.
- One untracked new file (NotificationService.php) briefly vanished during a `git stash` of pathspecs —
  untracked files aren't stashed with a pathspec; re-created it. Watch stash + untracked.

## Next step for whoever picks this up
- **Commit everything** (see `active.md` → Next Steps). Then deploy-unblock + prod DB backup + migration check.
- LINE image messages need public **HTTPS** URLs — only verifiable on a real deploy with a configured venue token.
- Remaining risks: **#5** (scheduler has only the expiry job — no subscription-expiry warning) and **#8** (mail).
