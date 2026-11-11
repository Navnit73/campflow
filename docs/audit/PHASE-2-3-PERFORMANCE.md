# Phase 2/3 — API & MongoDB performance (2026-11-11)

## How this was measured

- **Harness:** `npm run bench -- <label> [--size=large]`, implemented in `scripts/bench/run.ts` with a deterministic seeder in `scripts/bench/seed.ts`. It seeds a real `mongod` 8.2.6 (mongodb-memory-server), builds the schema's indexes first (as production does), then measures **22 service paths** (reads and writes):
  - 3 warm-up calls, then 25 timed calls (10 for heavy reports, 5 for exports);
  - p50/p95 latency;
  - **DB commands per call**, counted with the driver's command monitoring;
  - `explain("executionStats")` for the main query of each path.
- **Dataset ("large"):**
  - Main tenant: 300 sites, 25,000 guests, 80,000 reservations (≈4 years: 3 past, 1 future) and ≈125,000 payments.
  - A second tenant with ¼ of that volume, so tenant filtering is exercised.
- **Before = `baseline.json`:** the code after Phase 8 round 1, before any index or query change. **After = `after.json`.** Both raw files are in `docs/audit/perf/`.
- **Caveat:** local mongod, no network. Absolute milliseconds are lower than in production, and some timings vary run to run, so comparisons rely on the deterministic signals: plan shape, docs examined vs returned, and DB command counts.

## Results

| Path | p50 before | p50 after | Δ | DB cmds before → after |
|---|---:|---:|---:|---:|
| reservations.list (page 1) | 44.59 | 5.51 | -88% | 2 → 2 |
| reservations.list (page 200) | 69.2 | 5.57 | -92% | 2 → 2 |
| reservations.list (search 'smith') | 133.37 | 97.83 | -27% | 2 → 2 |
| reservations.list (status+30d range) | 1.71 | 0.83 | -51% | 2 → 2 |
| reservations.get (detail) | 0.5 | 0.49 | -2% | 4 → 4 |
| tape-chart (14 days) | 11.44 | 7.81 | -32% | 4 → 4 |
| tape-chart (60 days) | 31.62 | 28.39 | -10% | 4 → 4 |
| availability (all sites, 3 nights) | 3.04 | 2.96 | -3% | 4 → 4 |
| dashboard summary | 23.39 | 22.71 | -3% | 15 → 15 |
| reports (30 days) | 9.96 | 6.07 | -39% | 7 → 5 |
| reports (365 days) | 92.24 | 74.32 | -19% | 7 → 5 |
| guests.list (page 1) | 10.82 | 1.82 | -83% | 2 → 2 |
| guests.list (search 'garcia') | 26.69 | 24.8 | -7% | 2 → 2 |
| guests.get (300-stay history) | 2.49 | 2.45 | -2% | 3 → 3 |
| payments.list (page 1) | 39.6 | 9.24 | -77% | 4 → 4 |
| sites.list | 2.07 | 2.01 | -3% | 2 → 2 |
| public.search availability | 3.93 | 2.48 | -37% | 6 → 6 |
| public.confirmation lookup | 13.36 | 0.51 | -96% | 5 → 5 |
| broadcast audience (all guests) | 73.39 | 91.06 | +24% | 3 → 3 |
| reservations.create (+initial payment) | 2.39 | 2.34 | -2% | 9 → 9 |
| payments.record | 0.74 | 0.72 | -3% | 5 → 5 |
| export (master, last 30d) | 2946.06 | 2762.03 | -6% | 31 → 31 |

| Query | Before: plan · docs examined → returned | After: plan · docs examined → returned |
|---|---|---|
| reservations.list page1 | SORT ← IX:organizationId_1 · 80028 → 20 | LIMIT ← IX:organizationId_1_propertyId_1_checkInDate_-1_createdAt_-1 · 20 → 20 |
| reservations.list search | SORT ← IX:organizationId_1 · 80028 → 20 | LIMIT ← IX:organizationId_1_propertyId_1_checkInDate_-1_createdAt_-1 · 334 → 20 |
| reservations.count (list total) | GROUP ← IX:organizationId_1 · 80028 → 1 | GROUP ← COUNT_SCAN(organizationId_1_propertyId_1_checkInDate_-1_createdAt_-1) · 0 → 1 |
| tape-chart reservations | FETCH ← IX:propertyId_1_status_1_checkOutDate_1 · 7224 → 981 | FETCH ← IX:propertyId_1_status_1_checkOutDate_1_checkInDate_1 · 981 → 981 |
| availability overlap (all sites) | FETCH ← IX:propertyId_1_status_1_checkOutDate_1 · 7101 → 858 | FETCH ← IX:propertyId_1_status_1_checkOutDate_1_checkInDate_1 · 858 → 858 |
| availability overlap (one site) | LIMIT ← IX:propertyId_1_status_1_checkOutDate_1 · 113 → 1 | LIMIT ← IX:siteId_1_checkOutDate_1_checkInDate_1_status_1 · 1 → 1 |
| dashboard arrivals | FETCH ← IX:propertyId_1_status_1_checkInDate_1 · 22 → 22 | FETCH ← IX:propertyId_1_status_1_checkInDate_1 · 22 → 22 |
| dashboard on-site | FETCH ← IX:propertyId_1_status_1_checkInDate_1 · 2182 → 2182 | FETCH ← IX:propertyId_1_status_1_checkOutDate_1_checkInDate_1 · 2182 → 2182 |
| dashboard recent | LIMIT ← IX:propertyId_1_createdAt_-1 · 6 → 6 | LIMIT ← IX:propertyId_1_createdAt_-1 · 6 → 6 |
| dashboard outstanding (agg) | GROUP ← IX:propertyId_1_status_1_checkInDate_1 · 27543 → 1 | GROUP ← IX:propertyId_1_status_1_checkInDate_1 · 27543 → 1 |
| reports stays overlap (365d) | PROJECTION_SIMPLE ← IX:propertyId_1_status_1_checkOutDate_1 · 25360 → 18940 | PROJECTION_SIMPLE ← IX:propertyId_1_status_1_checkOutDate_1_checkInDate_1 · 18940 → 18940 |
| payments.list page1 | LIMIT ← IX:propertyId_1_createdAt_-1 · 20 → 20 | LIMIT ← IX:organizationId_1_propertyId_1_createdAt_-1 · 20 → 20 |
| payments by reservation | SORT ← IX:propertyId_1_reservationId_1 · 30 → 30 | SORT ← IX:propertyId_1_reservationId_1 · 30 → 30 |
| guests.list page1 | SORT ← IX:organizationId_1 · 25028 → 20 | LIMIT ← IX:organizationId_1_propertyId_1_updatedAt_-1 · 20 → 20 |
| guest history | SORT ← IX:propertyId_1_guestId_1 · 303 → 200 | SORT ← IX:propertyId_1_guestId_1 · 303 → 200 |
| guest by email (booking upsert) | FETCH ← IX:organizationId_1_email_1 · 0 → 0 | FETCH ← IX:organizationId_1_email_1 · 0 → 0 |
| confirmation lookup | FETCH ← IX:propertyId_1 · 80028 → 1 | FETCH ← IX:confirmationCode_1_organizationId_1 · 1 → 1 |
| sites.list | SORT ← IX:organizationId_1_propertyId_1 · 300 → 300 | SORT ← IX:organizationId_1_propertyId_1 · 300 → 300 |
| export guests (sorted) | SORT ← IX:propertyId_1 · 25028 → 25028 | FETCH ← IX:propertyId_1_createdAt_-1 · 25028 → 25028 |
| export reservations 30d ($or) | FETCH ← IX:propertyId_1_createdAt_-1 · 80028 → 8437 | FETCH ← OR ← IX:propertyId_1_checkInDate_1_checkOutDate_1 ← IX:propertyId_1_createdAt_-1 · 8437 → 8437 |

### Reading the numbers

- **List endpoints** (reservations, guests, payments) no longer sort the whole tenant in memory. They read exactly one page from an index, and the pagination count is answered from the index alone (`COUNT_SCAN`, 0 docs fetched). That is the 77–92% latency drop.
- **Public confirmation lookup:** 80,028 → 1 document examined. Besides being faster, this closes a scan-per-request DoS vector on an unauthenticated endpoint.
- **Date-window queries** (tape chart, availability grid, occupancy report, departures, on-site) now fetch only the documents they return.
- **Reports:** nights and per-site-type revenue are computed inside MongoDB. 18,940 documents no longer cross the wire, and DB commands drop from 7 to 5.
- **Free-text search** (`reservations.list search`, `guests.list search`) only improved on the "find a page" half. The total count still evaluates an unanchored, case-insensitive regex over every document in the property. See "Not changed".
- **Writes** (`reservations.create`, `payments.record`) are unchanged within noise. Each insert now maintains about half as many index entries (below).

### The one regression, explained (not fixed, by choice)

**broadcast audience (+24%).** The query plan is unchanged: it still fetches every reservation of the property to collect distinct emails. A controlled probe on the same 80k documents measured:

| Scan through | Time |
|---|---:|
| Single-field `propertyId_1` (the old index) | 46.9 ms |
| Either remaining compound index | 62–64 ms |

The cause is scan order versus storage order. In this seed `createdAt` is random relative to insertion order; in production it follows insertion order, so walking `propertyId_createdAt` is close to sequential. Restoring a single-field index for one owner-only action would add a write cost to every booking, so this is accepted.

### Regressions caught during the work (and fixed)

1. **Planner trap.** The window queries originally also filtered by `organizationId`. That made the planner prefer the new list index, which walked 73,785 docs, and the tape chart went from 11 ms to 51 ms. The fix was to filter window queries by `propertyId` only. It is globally unique and owned by the organization, and the site list in the same call stays org-scoped.
2. **Dropped a sort index too eagerly.** The dashboard's on-site list sorts by `checkOutDate`, and my explain probe had omitted that sort. The final design merges the two candidate indexes into one following the Equality → Sort/Range rule, `{propertyId, status, checkOutDate, checkInDate}`, which serves both the window queries and the sorted on-site list.

## Index changes (declared indexes, excluding `_id`): 71 → 36

| Collection | Before | After | Notes |
|---|---:|---:|---|
| reservations | 13 | 8 | Six single-field indexes removed (each a prefix of a compound, or unused). Added: list index `{organizationId, propertyId, checkInDate:-1, createdAt:-1}` and window index `{propertyId, status, checkOutDate, checkInDate}`. The per-site overlap index is reordered to `{siteId, checkOutDate, checkInDate, status}` (1 doc examined, was 113). The unique key is reordered to `{confirmationCode, organizationId}` |
| guests | 7 | 3 | `{organizationId, email}` unique. Added `{organizationId, propertyId, updatedAt:-1}` and `{propertyId, createdAt:-1}`. Unused `{org, phone}`, `{org, lastName}` and single-field indexes removed |
| payments | 7 | 4 | Added `{organizationId, propertyId, createdAt:-1}`. Singles and the unused `{reservationId, status}` removed |
| sites | 7 | 4 | Single-field indexes removed |
| add_ons | 5 | 1 | |
| export_schedules | 6 | 2 | |
| export_jobs | 5 | 3 | Added `{completedAt}` for the retention purge |
| broadcasts | 4 | 2 | Added unique partial `{organizationId, idempotencyKey}` |
| discounts, site_types, properties, users, audit_logs, organizations | 14 | 9 | Duplicate `index` + `unique` declarations and prefix-redundant singles removed |

**Rolling this out to an existing database.** Changing a schema doesn't drop old indexes. Run:

1. `MONGODB_URI=… npx tsx scripts/migrate-dedupe-guests.ts --dry-run`, then without `--dry-run` (merges duplicate guests so the unique index can build).
2. `MONGODB_URI=… npx tsx scripts/sync-indexes.ts` (dry-run diff), then `--apply`, off-peak.

## Not changed yet (with measurements)

| Path | p50 | Why it's still slow | Options |
|---|---:|---|---|
| Free-text search count | ≈96 ms | Unanchored `$regex` can't use an index, so the count scans all 80k documents | Cap the count (e.g. "1,000+"); Atlas Search; or a prefix-search mode. This is a product decision because it changes `pagination.total` |
| Dashboard | ≈23 ms | On-site list fetches 2,182 docs (the seed leaves stale check-ins), and the outstanding-balance sum reads 27.5k docs | Phase 4: per-property 30–60 s cache. Or a covered index on `pricing.balanceDue` (costs a write on every payment) |
| Reports, 365 days | ≈74 ms | Volume: 18.9k stays plus ≈45k payments aggregated | Phase 4 cache |
| Master export | ≈2.8 s | ExcelJS CPU time for ≈38k rows; the DB share is small | Background job plus streaming writer |
