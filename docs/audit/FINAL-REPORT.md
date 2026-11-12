# Final verification & performance report (Phase 9)

**Date:** 2026-11-11
**Scope:** the whole backend, plus the UI paths the backend fixes touched.
**Starting point:** commit `4175f30`.
**State:** rounds 1–3 are committed (`b78deff`, `4f42f88`); round 4 is in the working tree.
**Detailed logs:** `PHASE-1-AUDIT.md` (audit + fix logs), `PHASE-2-3-PERFORMANCE.md`, `PHASE-4-7-CACHING-TESTING.md`. Raw measurements: `perf/*.json`.

## 1. Totals

| Item | Count |
|---|---|
| API route handlers audited | **51** handlers in 35 route files (now 53 in 36; adds `GET`/`PATCH /api/property`) |
| Backend functions audited | **93** service and library functions |
| MongoDB models audited | **14**. New infrastructure collections: `site_booking_locks`, `rate_limits`, `cache_generations`, GridFS `export_files` |
| Audit findings | **42**: 7 Critical, 14 High, 14 Medium, 7 Low |
| Audit findings fixed | **39 fully, 3 partly or by design** (§3) |
| Further bugs found and fixed during the work | **22** (§4), including 2 regressions I introduced and fixed before they shipped |
| Declared indexes | **71 → 39** (−45%); each remaining index is tied to a measured query |
| Code changed since `4175f30` | 142 files, +8,428 / −2,656 lines (excluding the lockfile) |

## 2. Verification results (final run, final code)

| Check | Result |
|---|---|
| `tsc --noEmit` | **0 errors** |
| `next build` | **passes** |
| `eslint` | **203 errors** (229 before; none added by this work, all pre-existing `no-explicit-any` / React-hook rules in UI files) |
| `npm test`: unit | **28 tests**, 3 files: pricing (including weekend rates), dates and timezones, status rules, schemas, email escaping, utilities |
| `npm test`: integration | **106 tests**, 13 files: services and route handlers on a real `mongod`, plus one replica-set file for transactions |
| `npm run test:e2e` | **12 tests**: production build + replica-set MongoDB, every workflow over HTTP |
| `npm run test:ui` (Playwright) | **6 tests**: browser journeys (sign-up, sign-out/in, settings persistence, site modal, add-on toggle, public booking → confirmation) |
| `npm run bench` | 27 service paths + 26 query plans on 80k reservations / 25k guests / ~125k payments |
| `npm run load` | 6 HTTP scenarios × 50 connections + a 100-request booking burst; soak mode |
| **Total automated tests** | **152, all passing** (before: 0 that could fail) |

## 3. Audit findings: final status

| Severity | Fixed | Partly / by design |
|---|---|---|
| Critical (7) | C1 double booking · C2 client-priced add-ons · C4 JWT secret · C5 cross-tenant slug fallback · C6 unauthenticated cron · C7 mail reroute to a personal inbox | **C3:** the fabricated "paid" payment is removed; bookings are now pay-at-park. A payment gateway is a business decision. |
| High (14) | H1–H8, H10–H14 | **H9:** revocation and role changes take effect within the session-cache TTL (30 s by default, `SESSION_CACHE_TTL_MS`), not instantly |
| Medium (14) | M1–M10, M12–M14 | **M11:** login picks the first property of an organization. Latent: there is no API to create a second property today |
| Low (7) | L1–L6 | **L7:** lint debt reduced (229 → 203) but not cleared |

## 4. Bugs found and fixed after the audit

1. The export-schedule pause toggle reset the report type and frequency (another case of H1).
2. A partial guest update replaced the whole `rvDetails` subdocument.
3. Mongoose 9 rejects pipeline updates without `updatePipeline`. Caught by tests; it would have thrown in production on cancel, payment and guest-counter paths.
4. Deprecated Mongoose `new` option used on 7 calls.
5. **Dashboard response was 1.78 MB** (unbounded on-site list). Found by the load test: 124 → 2,214 req/s.
6. Tape-chart payload and CPU: 830 → 594 KB, 102 → 158 req/s.
7. Self-introduced: a planner trap on window queries (tape chart 11 → 51 ms). Caught by the benchmark and fixed.
8. Self-introduced: dropped an index the on-site sort needed. Caught by a rerun and fixed by merging two indexes.
9. **The public booking page told guests "Payment is automatically authorized"** after online payment had been removed. The copy is corrected.
10. Price previews used a hardcoded **7.5% tax**: on the public booking page and both staff reservation modals.
11. **The Settings page saved nothing.** It showed a success toast with no API behind it. There is now a real `/api/property`, and a browser test checks that values survive a reload.
12. **Every new park got a fake street address**, and the public pages fell back to "100 Pine Creek Rd". Both removed; the real address comes from Settings.
13. Quiet hours were hardcoded on the confirmation page.
14. Booking emails rendered ", ," for parks without an address.
15. **Weekend rates were stored but never charged.** Friday and Saturday nights now use them, and the rate is frozen on the reservation.
16. Site `maxOccupancy` was ignored in the public flow.
17. The broadcast "in-house" audience included arrivals up to a week ahead and stale check-ins.
18. An empty broadcast audience silently emailed staff and was recorded as "sent".
19. A login alert was emailed on every login; it now goes out only for a new device.
20. Monthly export schedules overflowed (the 31st ran on the 3rd of the next month), and `00:30` ran at `08:30`.
21. Export and broadcast runs could duplicate on retry or overlap. Both are now atomically claimed and idempotent.
22. Cancellations sent the guest no notice (L3).

## 5. Security issues resolved

- **Authentication and secrets:**
  - forgeable JWT when the secret was missing (C4);
  - the token is no longer exposed in JSON or `localStorage` (H9);
  - deactivation and role changes are now enforced (H9);
  - constant-time login;
  - minimum password length raised to 8;
  - unauthenticated cron fixed (C6).
- **Tenant isolation:**
  - slug fallback into another park (C5);
  - cross-tenant site move (H2);
  - tenant-scoped delete check (L1);
  - isolation tests at both service and HTTP level.
- **Access control:** role checks on every write and admin route (H8); refunds need a manager or owner.
- **Data exposure:**
  - public responses are field-allowlisted (H6, H7);
  - enumerable confirmation codes replaced with 8 characters from a CSPRNG (H6);
  - masked audience previews;
  - no PII in mail logs;
  - no mail diverted to a personal inbox (C7);
  - 500 responses no longer leak internals (H10).
- **Injection:**
  - HTML injection in all email templates (H12);
  - regex injection / ReDoS in all searches (M5), and search is now indexed tokens;
  - unknown keys rejected on settings updates.
- **Abuse:**
  - rate limits on login, register, public booking, availability and confirmation, shared across instances via MongoDB;
  - export row caps;
  - search `maxTimeMS`.

## 6. Performance: before vs after (same seed and machine; `baseline.json` vs `final.json`)

### Service latency and DB commands (p50)

| Path | p50 ms before | p50 ms after | Δ | DB cmds before → after |
|---|---:|---:|---:|---:|
| reservations.list (page 1) | 44.59 | 5.56 | -88% | 2 → 2 |
| reservations.list (page 200) | 69.2 | 5.61 | -92% | 2 → 2 |
| reservations.list (search 'smith') | 133.37 | 1.12 | -99% | 2 → 3 |
| reservations.list (search, no match — worst case) | — | 0.47 | new | — → 3 |
| reservations.list (search by code prefix) | — | 0.33 | new | — → 2 |
| reservations.list (status+30d range) | 1.71 | 0.74 | -57% | 2 → 2 |
| reservations.get (detail) | 0.5 | 0.46 | -8% | 4 → 4 |
| tape-chart (14 days) | 11.44 | 5.85 | -49% | 4 → 2 |
| tape-chart (60 days) | 31.62 | 20.3 | -36% | 4 → 2 |
| availability (all sites, 3 nights) | 3.04 | 2.89 | -5% | 4 → 4 |
| dashboard summary | 23.39 | 20.17 | -14% | 15 → 15 |
| reports (30 days) | 9.96 | 6.1 | -39% | 7 → 5 |
| reports (365 days) | 92.24 | 71.82 | -22% | 7 → 5 |
| dashboard summary (cached) | — | 0 | new | — → 0 |
| reports 365d (cached) | — | 0 | new | — → 0 |
| dashboard after a write (invalidated) | — | 21.47 | new | — → 21 |
| guests.list (page 1) | 10.82 | 1.86 | -83% | 2 → 2 |
| guests.list (search 'garcia') | 26.69 | 0.89 | -97% | 2 → 3 |
| guests.get (300-stay history) | 2.49 | 2.3 | -8% | 3 → 3 |
| payments.list (page 1) | 39.6 | 9.72 | -75% | 4 → 4 |
| sites.list | 2.07 | 2 | -3% | 2 → 2 |
| public.search availability | 3.93 | 2.31 | -41% | 6 → 4 |
| public.confirmation lookup | 13.36 | 0.53 | -96% | 5 → 5 |
| broadcast audience (all guests) | 73.39 | 91.04 | +24% | 3 → 3 |
| reservations.create (+initial payment) | 2.39 | 2.88 | +21% | 9 → 11 |
| payments.record | 0.74 | 0.88 | +19% | 5 → 6 |
| export (master, last 30d) | 2946.06 | 2735.3 | -7% | 31 → 31 |

### Query plans: documents examined → returned

| Query | before: docs examined → returned | after: docs examined → returned | after plan |
|---|---:|---:|---|
| reservations.list page1 | 80028 → 20 | 20 → 20 | LIMIT ← IXSCAN(organizationId_1_propertyId_1_checkInDate_-1_createdAt_-1) |
| reservations.list search | 80028 → 20 | 335 → 20 | LIMIT ← IXSCAN(organizationId_1_propertyId_1_checkInDate_-1_createdAt_-1) |
| search tokens: rare term (no match) | — | 0 → 0 | SORT ← IXSCAN(propertyId_1_searchTokens_1) |
| search tokens: common term 'smith' | — | 335 → 20 | LIMIT ← IXSCAN(organizationId_1_propertyId_1_checkInDate_-1_createdAt_-1) |
| search legacy check (searchTokens: null) | — | 0 → 0 | LIMIT ← IXSCAN(propertyId_1_searchTokens_1) |
| reservations.count (list total) | 80028 → 1 | 0 → 1 | GROUP ← COUNT_SCAN(organizationId_1_propertyId_1_checkInDate_-1_createdAt_-1) |
| tape-chart reservations | 7224 → 981 | 981 → 981 | IXSCAN(propertyId_1_status_1_checkOutDate_1_checkInDate_1) |
| availability overlap (all sites) | 7101 → 858 | 858 → 858 | IXSCAN(propertyId_1_status_1_checkOutDate_1_checkInDate_1) |
| availability overlap (one site) | 113 → 1 | 1 → 1 | LIMIT ← IXSCAN(siteId_1_checkOutDate_1_checkInDate_1_status_1) |
| dashboard arrivals | 22 → 22 | 22 → 22 | IXSCAN(propertyId_1_status_1_checkInDate_1) |
| dashboard departures | — | 3 → 3 | IXSCAN(propertyId_1_status_1_checkOutDate_1_checkInDate_1) |
| dashboard upcoming | — | 8 → 8 | LIMIT ← IXSCAN(propertyId_1_checkInDate_1_checkOutDate_1) |
| dashboard on-site | 2182 → 2182 | 2182 → 2182 | IXSCAN(propertyId_1_status_1_checkOutDate_1_checkInDate_1) |
| dashboard recent | 6 → 6 | 6 → 6 | LIMIT ← IXSCAN(propertyId_1_createdAt_-1) |
| dashboard outstanding (agg) | 27543 → 1 | 27544 → 1 | GROUP ← IXSCAN(propertyId_1_status_1_checkInDate_1) |
| reports stays overlap (365d) | 25360 → 18940 | 18940 → 18940 | IXSCAN(propertyId_1_status_1_checkOutDate_1_checkInDate_1) |
| payments.list page1 | 20 → 20 | 20 → 20 | LIMIT ← IXSCAN(organizationId_1_propertyId_1_createdAt_-1) |
| payments by reservation | 30 → 30 | 58 → 58 | SORT ← IXSCAN(propertyId_1_reservationId_1) |
| guests.list page1 | 25028 → 20 | 20 → 20 | LIMIT ← IXSCAN(organizationId_1_propertyId_1_updatedAt_-1) |
| guest history | 303 → 200 | 303 → 200 | SORT ← IXSCAN(propertyId_1_guestId_1) |
| guest by email (booking upsert) | 0 → 0 | 0 → 0 | IXSCAN(organizationId_1_email_1) |
| confirmation lookup | 80028 → 1 | 1 → 1 | IXSCAN(confirmationCode_1_organizationId_1) |
| sites.list | 300 → 300 | 300 → 300 | SORT ← IXSCAN(organizationId_1_propertyId_1) |
| export guests (sorted) | 25028 → 25028 | 25029 → 25029 | IXSCAN(propertyId_1_createdAt_-1) |
| export reservations 30d ($or) | 80028 → 8437 | 8437 → 8437 | OR ← IXSCAN(propertyId_1_checkInDate_1_checkOutDate_1) ← IXSCAN(propertyId_1_createdAt_-1) |

### HTTP under load (`load.json`, production build, 50 connections × 10 s)

| Scenario | First load run | Final |
|---|---|---|
| GET /api/dashboard | 124 req/s, p50 340 ms | **2,214 req/s, p50 21 ms** |
| GET /api/reservations (page 1) | 626 req/s | 668 req/s, p50 74 ms |
| GET tape chart (14 d) | 102 req/s, p50 483 ms | **158 req/s, p50 313 ms** |
| GET /api/reports?days=365 | — | 7,967 req/s (cached), p50 5 ms |
| GET public availability | — | 509 req/s, p50 96 ms |
| POST /api/reservations | 251 req/s | 211 req/s, p50 227 ms (see trade-offs) |
| **100 identical bookings at once** | 1 × 201, 99 × 409 | **1 × 201, 99 × 409, 1 row in DB** |
| Errors / non-2xx | 0 | **0** |
| MongoDB connections | 41–42 | 41–42 (pool bounded) |
| Soak RSS (4 rounds) | — | 364 → 790 → 812 → 819 MB (plateau, no leak trend) |

### Trade-offs, stated plainly

- **Writes are slightly slower.** A booking now takes 9 → 11 DB commands and 2.39 → 2.88 ms (+0.5 ms); a payment takes 5 → 6. HTTP write throughput is 251 → 211 req/s. The cost buys correctness and features: cross-instance cache invalidation (+1 command) and search-token maintenance (+1 command, plus ~10 multikey index entries per booking). The per-site booking lock was already in the baseline.
- **Broadcast audience (+24%):** the plan is unchanged; the difference is an artefact of the seed's scan order (measured 46.9 vs 62–64 ms with the old vs new index). It's an owner-only action, so I accepted it rather than add a write-cost index.
- **Search semantics** changed from substring to **word-prefix** ("smi" → Smith; "mith" no longer matches). This is what makes every search an index seek. Documents written before the change fall back to the old scan until `scripts/migrate-search-tokens.ts` runs.
- **Cached aggregates** can be at most 60 s (dashboard) or 5 min (reports, public catalog) stale **only if** a write bypasses the services, such as a raw database script. Every write through the services invalidates them across all instances within 1 s. Availability is never cached.

### Measurement caveats

All timings come from a local `mongod` with no network latency, on one machine shared with the load generator. Absolute milliseconds will be higher in production. The portable signals are the plan shapes, docs-examined counts and DB command counts in the tables above.

## 7. Deployment checklist (in order)

1. **Environment:** `JWT_SECRET` (≥ 32 characters, required in production), `CRON_SECRET` (≥ 16; the cron caller sends `Authorization: Bearer`), `MONGODB_URI`. Optional: `SESSION_CACHE_TTL_MS`, `EXPORT_RETENTION_DAYS`, `DISABLE_CACHE`, `RESEND_TEST_EMAIL` (development only).
2. **Back up the database.**
3. **Merge duplicate guests:** `npx tsx scripts/migrate-dedupe-guests.ts --dry-run`, then run it without `--dry-run`.
4. **Sync indexes:** `npx tsx scripts/sync-indexes.ts`, then `--apply`, off-peak. It drops undeclared indexes and builds the new ones.
5. **Backfill search tokens:** `npx tsx scripts/migrate-search-tokens.ts`. Until it has run, search uses the legacy scan path.
6. **Hosting:** confirm a replica set (Atlas qualifies) so bookings use real transactions; confirm the platform allows `maxDuration = 300` for broadcasts.
7. **Resend:** verify the sending domain.
8. **Settings:** owners should enter their park's address in Settings. New parks no longer get a placeholder address.

## 8. Remaining issues (none blocking)

| Item | Why it's open | Suggested next step |
|---|---|---|
| Online payments (C3) | A business decision | Integrate a gateway (Stripe/Dodo) with signed webhooks and idempotency; the ledger is ready for it |
| Multi-property login (M11) | Unreachable today (no API to add a second property) | Property switcher plus a `propertyId` claim chosen at login |
| Revocation lag up to `SESSION_CACHE_TTL_MS` (H9) | Per-instance memo | Bump a user generation on deactivation (same mechanism as the cache) |
| Lint: 203 errors | Pre-existing `any` and hook rules in UI components | A typed API client and a pass over the components |
| Tape-chart throughput ≈ 158 req/s per instance | CPU for serializing ~1,300 rows | Visible-window paging or a compact row format |
| Excel exports are built in memory | Bounded by a 50k-row cap | Streaming `WorkbookWriter` as a background job |
| Personal email address in git history | History rewrite is out of scope | `git filter-repo` if the repo will be shared |
| Cancellation refunds | Policy-dependent | Staff issue refunds manually (role-guarded); automate once the policy is defined |
