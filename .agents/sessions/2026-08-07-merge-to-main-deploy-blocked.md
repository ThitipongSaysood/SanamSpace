# 2026-08-07 — Merged to main; deploy blocked on a missing server directory

_Agent: Claude (Opus 5)_

Short session. The 2026-08-02 work was merged to `main` and pushed. The production deploy then failed —
on infrastructure, not on the code.

## What happened

```
9c3ef49  Merge branch 'feat/venue-content-portal-gaps-checkin'   ← main = origin/main
3fb6349  docs(agents): close out 2026-08-02
6587d7b  feat(ui): make every back-office table usable on a phone
42fb4e4  feat: venue banners, portal gaps, real QR check-in, bookings list
```

Merged with `--no-ff` deliberately: the whole session can be undone with one `git revert -m 1 9c3ef49`.

**Deploy to Production #63 failed after 1m 35s**, at *Sync frontend to server (rsync)*:

```
rsync: [Receiver] mkdir "***/frontend" failed: No such file or directory (2)
rsync error: error in file IO (code 11)
```

`***` is the masked `DEPLOY_PATH`. rsync creates only the final directory, never its parents — so
`DEPLOY_PATH` itself does not exist on the server. Nothing to do with this session's changes; any push
would have failed the same way. The last successful deploy was a month earlier, so something changed on
the server in between (rebuilt host, moved path, or an edited `DEPLOY_PATH` secret).

## Where production actually stands

| Step | |
| --- | --- |
| build frontend | ✅ |
| composer install | ✅ |
| **rsync frontend** | ❌ **died here (6 of 8)** |
| rsync backend | not reached |
| migrate + restart | not reached |

**No migrations ran. No files were overwritten.** Production is still serving the old code, untouched and
working. The half-deployed state feared before the merge — new code against an old schema — did not
happen, because the run died before either could change.

The 14 pending migrations, including the one that drops five columns from `organization_settings`, are
**still pending**.

## To unblock

On the server:

```bash
ls -la /var/www/html/sanamspace          # DEPLOY_PATH per memory
sudo mkdir -p /var/www/html/sanamspace/{frontend,backend}
sudo chown -R "$USER":"$USER" /var/www/html/sanamspace
```

Then **Re-run jobs** on run #63 — no new commit needed.

If the app lives somewhere else now, fix the `DEPLOY_PATH` secret instead
(Settings → Secrets and variables → Actions).

**Worth doing either way:** add an `mkdir -p "$DEPLOY_PATH"/{frontend,backend}` over SSH before the two
rsync steps, so a missing directory is created rather than failing the deploy. Not done yet — it changes
`.github/workflows/deploy.yml`, which makes the next run deploy **both** sides, and that is a decision to
make deliberately rather than as a side effect of a fix.

## What I got wrong, worth remembering

I reported the branch as ready to deploy having run tsc, lint, vitest and Playwright — but **never
`npm run build`, and never a migration against MySQL**. Production is not SQLite. The build turned out
fine (verified afterwards, it passes), and the migrations still have not been exercised on MySQL, so that
risk is live and untested:

- `organization_settings` gains two `varchar(2000)` columns. Under utf8mb4 that is ~8 KB each against
  MySQL's 65,535-byte row limit — SQLite has no such limit, so a passing local run proves nothing here.
- Verify on a copy of the production database before re-running, or take a backup first.

## Next session

1. Create the directory (or fix the secret), re-run #63, watch the **migrate** step specifically.
2. Take a production database backup first — nobody has taken one, and step 3 of the deploy drops columns.
3. Then the checks in `.agents/active.md` → post-deploy list.
