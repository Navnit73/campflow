# Phase 4 (caching) and Phase 7 (E2E + load) — 2026-11-11

## Phase 4: caching

### Design (`lib/cache/index.ts`)

- **What is cached:** read-through, in-process LRU (2,000 entries) with a per-entry TTL, used only for staleness-tolerant aggregates.
- **Cross-instance invalidation:** every key embeds its scope's **generation**, a counter stored in MongoDB (`cache_generations`).
  - A write calls `invalidateProperty(id)`, which runs `$inc` on the generation. Every instance stops using old entries after at most 1 s, because each instance re-reads a generation at most once per second.
  - The instance that performed the write sees the new generation immediately.
  - No Redis is needed. Redis would only replace the per-instance LRU if hit rates across instances ever matter.
- **Stampede protection:** concurrent misses for the same key share one in-flight load (single-flight).
- **Invalidation race:** if a write lands while a value is loading, the loaded value is **not stored**.
- **Failures:** errors and not-found results are never cached.
- **Kill switch:** `DISABLE_CACHE=true`.

### What is cached, and what deliberately isn't

| Data | TTL | Invalidated by | Why |
|---|---|---|---|
| Dashboard summary (per property) | 60 s | Any reservation, payment, site, site-type, guest or add-on write for the property | The most-loaded screen; 15 DB commands per computation |
| Financial reports (per property and period) | 5 min | Same | 365-day report ≈ 73 ms of aggregation |
| Public property by slug | 5 min | TTL only (no property-edit API exists) | Read on every public request |
| Public active add-ons (per property) | 5 min | Add-on writes | Read on every public search |
| **Never cached** | — | — | Availability, tape chart, per-site overlap checks, reservation/guest/payment lists, confirmation lookups, auth decisions (beyond the existing 30 s user-state memo) |

**Documented limitation (has a test):** writes that bypass the services, such as raw database scripts and migrations, don't invalidate. Cached aggregates then refresh within their TTL. Scripts should call `invalidateProperty` (the dedupe migration only touches guests, which only affects the guest count).

### Measured effect

Service-level benchmark. Before = Phase 2/3 baseline, after = `phase4.json`; same seed and machine:

| Path | p50 ms before | p50 ms after | DB commands before → after |
|---|---:|---:|---:|
| reservations.list (page 1) | 44.59 | 5.66 | 2 → 2 |
| reservations.list (page 200) | 69.2 | 5.65 | 2 → 2 |
| reservations.list (search 'smith') | 133.37 | 19.18 | 2 → 2 |
| reservations.list (search, no match — worst case) | — | 122.92 | — → 2 |
| reservations.list (search by code prefix) | — | 0.34 | — → 2 |
| reservations.list (status+30d range) | 1.71 | 0.84 | 2 → 2 |
| reservations.get (detail) | 0.5 | 0.47 | 4 → 4 |
| tape-chart (14 days) | 11.44 | 7.09 | 4 → 4 |
| tape-chart (60 days) | 31.62 | 24.48 | 4 → 4 |
| availability (all sites, 3 nights) | 3.04 | 2.96 | 4 → 4 |
| dashboard summary | 23.39 | 20.68 | 15 → 15 |
| reports (30 days) | 9.96 | 6.25 | 7 → 5 |
| reports (365 days) | 92.24 | 75.75 | 7 → 5 |
| dashboard summary (cached) | — | 0 | — → 0 |
| reports 365d (cached) | — | 0 | — → 0 |
| dashboard after a write (invalidated) | — | 22.75 | — → 21 |
| guests.list (page 1) | 10.82 | 1.89 | 2 → 2 |
| guests.list (search 'garcia') | 26.69 | 16.28 | 2 → 2 |
| guests.get (300-stay history) | 2.49 | 2.43 | 3 → 3 |
| payments.list (page 1) | 39.6 | 9.49 | 4 → 4 |
| sites.list | 2.07 | 1.98 | 2 → 2 |
| public.search availability | 3.93 | 2.3 | 6 → 4 |
| public.confirmation lookup | 13.36 | 0.56 | 5 → 5 |
| broadcast audience (all guests) | 73.39 | 90.78 | 3 → 3 |
| reservations.create (+initial payment) | 2.39 | 2.4 | 9 → 10 |
| payments.record | 0.74 | 0.83 | 5 → 6 |
| export (master, last 30d) | 2946.06 | 2798.28 | 31 → 31 |

- **Cache hits** cost about 3 µs and **0** DB commands. The "after a write" row is the worst case: every read follows an invalidating write.
- **Writes** pay one extra DB command for the invalidation (booking 9→10, payment 5→6) with no measurable latency change.

## Still-open items from round 2: all addressed

| Item | Fix | Evidence |
|---|---|---|
| **Search total scans the property** | The count stops at 1,000 for free-text searches (`totalCapped` flag; the UI shows "1,000+"). Confirmation-code-shaped input (`RV-7MN…`, `rv7mn`) uses an anchored prefix seek on `{confirmationCode, organizationId}`. Every search query has `maxTimeMS` 3 s. Non-search lists keep exact, index-only counts | `search 'smith'` 96 → **19 ms**. Code prefix **0.34 ms**, index seek (the regex path took 42.7 ms). A term with no matches is still ~123 ms p50 / 470 ms p95: an unanchored substring regex can't use an index, and `maxTimeMS` is the guard. Tests in `reservations.test.ts` |
| **Rate limits per instance** | MongoDB-backed fixed window: one atomic pipeline upsert, TTL-expired, shared by every instance. Falls back to in-process limits if the DB is unreachable | Exactly `limit` of 30 concurrent hits pass; the window resets (`cache.test.ts`) |
| **Staff add-on prices trusted** | Catalog items (`addOnId`) are priced from the catalog on create and edit. Items already on a reservation keep their booked price (no silent re-pricing). Manual desk charges (no `addOnId`) keep entered values. Other properties' add-ons are rejected | `reservations.test.ts` |
| **Login alert on every login** | An alert is sent only for a new device: SHA-256 of user agent + network prefix (/24 for IPv4, /48 for IPv6). Raw IPs are never stored. The last 10 per user are kept; the signup device is trusted | `auth.test.ts` |
| **Stuck broadcasts not resumed** | The cron job now also: delivers `queued` broadcasts older than 2 min; resets and re-delivers `sending` ones older than 15 min (safe, because every chunk's idempotency key makes the provider drop chunks it already sent within its 24 h window); marks ones older than 23 h `failed` with a reason rather than risk duplicates | `broadcasts.test.ts` |
| **Phase 7: E2E and load tests missing** | See below | |

## Phase 7: automated testing

| Suite | Command | Count | What it runs against |
|---|---|---:|---|
| Unit | `npm test` | 3 files | Pure logic: pricing, dates/timezones, status rules, schemas, templates, utilities |
| Integration | `npm test` | 12 files | Services and route handlers against real `mongod` (standalone, plus one replica-set file for transactions) |
| **Total `npm test`** | | **119 tests, 15 files** | |
| **E2E** | `npm run test:e2e` | **12 tests** | Production build (`next start`) + replica-set MongoDB, over HTTP with cookie sessions |
| Benchmark | `npm run bench` | 25 paths + 23 explains | Service level, seeded 80k-reservation dataset |
| **Load / soak** | `npm run load [-- --rounds=4]` | 6 scenarios + burst | Production server under autocannon, seeded dataset |

**E2E workflows covered:**

- Owner signup (cookie-only session)
- Site setup with partial updates that don't clobber other fields
- Guest create, partial update, search, duplicate rejected
- Full desk lifecycle: create with deposit, double-book 409, extend, move site, check-out-before-check-in 409, check-in, idempotent payment replay, partial refund, over-refund 422, idempotent check-out, cancel-after-checkout 409, folio totals
- Cancel, then reactivation refused once the slot is resold
- **20 simultaneous HTTP bookings → exactly one 201**
- Public availability, booking at catalog prices and confirmation, with **the cached dashboard reflecting it immediately**
- Staff vs manager permissions, and deactivation taking effect within the session-cache TTL
- Export and xlsx download
- Broadcast: 202, delivered after the response, retry deduplicated
- Cron auth
- Cross-tenant HTTP isolation

### Load test (`load.json`): 50 connections × 10 s per scenario, production server, 80k-reservation dataset, local machine

| Scenario | req/s | p50 ms | p99 ms | non-2xx | errors |
|---|---:|---:|---:|---:|---:|
| GET /api/dashboard (cached) | 2,149 | 21 | 49 | 0 | 0 |
| GET /api/reservations (page 1) | 612 | 80 | 102 | 0 | 0 |
| GET /api/reservations/tape-chart (14 d) | 117 | 424 | 476 | 0 | 0 |
| GET /api/reports?days=365 (cached) | 7,742 | 5 | 13 | 0 | 0 |
| GET public availability | 506 | 97 | 133 | 0 | 0 |
| POST /api/reservations (unique slots) | 257 | 187 | 299 | 0 | 0 |

- **Burst of 100 identical bookings over HTTP:** 1 × 201, 99 × 409, and **1** row in the database.
- **DB connections:** stayed at 41–42 throughout, so the pool is bounded (`maxPoolSize` 10 per process, plus the test harness's own connections).
- **Memory (soak, `load-soak.json`, 4 full rounds):** RSS 364 → 790 → 812 → 819 MB. It plateaus after the first round warms the heap, with no leak trend; the residual growth matches the ~2.5k reservations inserted per round.
- **CPU:** read scenarios saturate one Node process (≈110–180% including GC and I/O threads). Throughput scales by adding instances; nothing in the app is instance-local except caches, which are coherent via generations.

**Two problems the load test found (and fixes):**

1. **The "cached" dashboard handled only 124 req/s (p50 340 ms).** The response was **1.78 MB**: the on-site list returned every checked-in stay (2,182 in the seed). The list is now capped at the 50 soonest departures, and an exact count comes from the index. The UI shows the count; the response is 75 KB. Result: **2,149 req/s, p50 21 ms (17×)**.
2. **Tape chart CPU-bound at about 102–117 req/s per instance.** The projection is now limited to the fields the grid reads, measured at **830 → 714 KB (−14%)**, which gave +15% throughput. The rest is decoding and serializing ~1,300 documents per request. That's acceptable for a screen staff open interactively. Further options: incremental loading by visible date range, or a compact array format.

## Still open (none blocking)

- **Substring search on a term with no matches** scans the whole property (~123 ms at 80k reservations). It's bounded by `maxTimeMS`; Atlas Search would remove it.
- **Tape-chart throughput** per instance (above).
- **No browser-driven UI tests (Playwright).** E2E covers every workflow at the HTTP/API layer against the production build. UI-level tests would also catch rendering and regressions in client-side state.
