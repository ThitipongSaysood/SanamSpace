# Session 2026-08-07 ~20:00 — Broadcast history CRUD, small UX fixes, CRM review

Continues the 1800 checkpoint (broadcast + banner + UI). This is the day's close-out.

## What was done
- **Broadcast history CRUD** — `PUT /owner/broadcasts/{id}` (edit, **draft only**, 422 if sent) and
  `DELETE /owner/broadcasts/{id}` (soft delete), both org-scoped. `OwnerBroadcastResource` now exposes
  `segmentId` (needed to restore a segment audience when editing). Frontend: history rows are clickable →
  a **detail sheet** with view / edit / send / delete; a **"บันทึกร่าง"** path (create draft without
  sending) so drafts exist to edit/send later; an edit-mode banner. Added `BroadcastLineTest` cases for
  edit-draft / edit-sent-422 / delete → backend **246/246**.
- **UX**: after send the wizard shows a full **success screen** ("ส่งสำเร็จ" + count + "ยิงโปรใหม่" reset);
  removed a "+ สร้างใหม่" button from the history header (didn't save steps — the wizard is already at the top).
- **CRM review (no code)** — audited the CRM against standard practice + PDPA and wrote the roadmap to
  `.agents/topics/crm-roadmap.md` (11 work packages, P0/P1/P2, split for parallel agents). Headline gaps:
  no consent/opt-out/PDPA, no CRM permission gating, static segments (criteria unused), timeline is
  seed-only, broadcasts persist only `recipient_count`.

## State at end
Local green: backend **246/246** · tsc clean · vitest 24/24 · lint 13 (= baseline). Committed + pushed to
`main` at close (see the commit). Deploy remains blocked (`DEPLOY_PATH`); pushing re-triggers the same
failing rsync step — harmless, no migrations run on prod.

## Next step
- Start the CRM roadmap at **P0** (PDPA consent+suppression → permission gating → persist delivery). See
  `topics/crm-roadmap.md`.
- Deploy unblock + prod DB backup + migration check still pending (see `active.md`).
