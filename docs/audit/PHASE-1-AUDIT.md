# Phase 1 — Backend, API, Database & Business-Logic Audit

**Date:** 2026-11-11 · **Commit audited:** `4175f30` (main) · **Mode:** read-only; no code changed.

## 0. Scope & method

| Item | Count |
|---|---|
| API route files / HTTP handlers | 35 / 51 |
| Service + lib functions | 93 |
| Mongoose models | 14 (68 index declarations) |
| Zod validation modules | 9 |
| Automated tests that can actually fail | **0** (4 script files using `console.assert`, no runner, no `test` script) |

Baseline checks run during the audit:

- `tsc --noEmit`: **passes**
- `eslint`: **339 problems (229 errors)**. 200 of the errors are `no-explicit-any` and 23 are `react-hooks/set-state-in-effect`.
- `next build`: not run yet; it is the first step of Phase 8.

**Coverage:**

- **Read line by line:** all services, models, validators, lib utilities and API routes.
- **Delegated:** a sub-audit covered the export, scheduled-export and broadcast-email subsystem. Its Critical/High claims were re-verified against the code (C6, C7).
- **Verified by running code:** H1 (the Zod `.partial()` defaults).
- **Not measured:** query timings. No database is configured locally (`MONGODB_URI` is unset, so dev falls back to an in-memory MongoDB). Every performance item below is a static finding. The explain plans and timings are part of Phase 3.

### Architecture summary

- **Layering:** Next.js 16 App Router route handlers → static service classes → Mongoose models.
- **Auth:** JWT (7-day expiry) in an httpOnly cookie, or a `Bearer` header. Each route calls `requireAuth`. There is no middleware or proxy.
- **Tenancy:** `organizationId` + `propertyId` from the JWT are passed into every service call.
- **No** transactions, caching, job queue, rate limiting, payment gateway or webhooks exist. The "payment processing" phase of the brief applies to manual ledger entries only.
- **Email:** Resend.
- **Exports:** ExcelJS. Generated files are stored as base64 inside MongoDB.

---

## 1. Critical

| ID | Finding | Location | Failure scenario | Fix |
|---|---|---|---|---|
| **C1** | **Double-booking race.** Every booking path checks availability and then inserts, with no lock, transaction or constraint between the two steps. | `reservation.service.ts:140,253`, `:433-461` (update / drag-drop), `public-booking.service.ts:164,246` | Two staff members (or two online guests) book site 12 for the same nights at the same moment. Both `findOne` checks see no conflict and both reservations are inserted. | Serialize bookings per site: a transaction that writes a per-site lock document (or bumps a per-site version) and re-checks for overlap inside the same transaction. Alternative: per-night claim documents with a unique `{siteId, night}` index. Requires a replica set (Atlas qualifies; tests need `MongoMemoryReplSet`). |
| **C2** | **Public booking trusts add-on prices sent by the client.** `price`, `pricingType` and `taxable` come straight from the request body. Add-on IDs are never looked up, so inactive add-ons and other properties' add-ons are also accepted. | `public-booking.service.ts:228`, `public-booking.schema.ts:22-29` | Anyone can POST `addOns:[{name:"Golf Cart",price:0,...}]` and receive a $0 add-on. The booking is recorded as paid (see C3). | Accept only `{addOnId, quantity}`. Load the add-ons server-side, filtered by `propertyId` and `isActive`, and price from the database. Apply the same rule to the staff endpoints. |
| **C3** | **Online bookings are marked "paid in full" without any payment being taken.** The code creates a `Payment` with `status:"completed"` and a made-up `TXN-xxxx` reference. The `paymentMethod` field is ignored. | `public-booking.service.ts:242-301` | Every online booking shows `balanceDue: 0` and counts as revenue in reports and the dashboard, even though no money moved. | A business decision is needed (see §8). Either integrate a payment gateway with signed webhooks and idempotency, or create the booking as `pending` with the full balance due. |
| **C4** | **The JWT secret has a hardcoded fallback.** | `lib/auth/jwt.ts:4` | If `JWT_SECRET` is missing in any environment, anyone can sign a token for any `organizationId` with `role:"owner"`. That means full access to every tenant. | Throw at startup when the secret is missing or shorter than 32 bytes. |
| **C5** | **An unknown booking slug falls back to another tenant's property.** | `public-booking.service.ts:29` | `/book/typo` resolves to the oldest property in the database. Availability searches and bookings, including guest records, land in another park's data. | Return 404. Remove the fallback. |
| **C6** | **The cron endpoint is unauthenticated, and it accepts GET.** | `app/api/cron/exports/route.ts:5-21` | Anyone, including a web crawler, can trigger every tenant's due exports: heavy CPU and memory, plus duplicate report emails (see H11). | Require `Authorization: Bearer ${CRON_SECRET}` compared with `timingSafeEqual`. Fail closed when the env var is unset. |
| **C7** | **Any tenant's email can be rerouted to a hardcoded personal Gmail address.** The reroute fires on any `validation_error`, or on any error at all while the default `onboarding@resend.dev` sender is in use. It forwards the full HTML **and attachments** (Excel reports with guest PII) and reports `success:true`. | `lib/mail/resend.ts:11-12, 67-96` | In production without a verified domain, every tenant's booking emails and scheduled guest/payment exports go to one developer inbox. | Remove the fallback in production. Never forward attachments. Remove the hardcoded address from the repo. |

## 2. High

| ID | Finding | Location | Scenario / impact | Fix |
|---|---|---|---|---|
| **H1** | **Every partial update (PATCH) resets fields the caller didn't send.** `createXSchema.partial()` still applies `.default()` values in Zod 4. Verified by running Zod 4.4.3: `{rate:70}` parses to `{status:"available",notes:"",isVip:false,rate:70}`. | `site.schema.ts:19,38`, `guest.schema.ts:31`, `addon.schema.ts:31` | **This is live today:** the Services page "toggle active" sends `{isActive}`, which resets that add-on's category, pricing type, taxable flag, icon, sort order and description. The same applies to any partial site PATCH: a site under `maintenance` silently becomes `available`, and therefore bookable online. | Write update schemas without defaults (or strip the defaults when deriving them), and send `$set` only for keys the client actually provided. |
| **H2** | **A reservation can be moved onto another tenant's site.** `updateReservation` loads the new site with `Site.findById(newSiteId)`, with no org/property filter. | `reservation.service.ts:420` | A user in org A sends org B's `siteId`. The reservation is re-pointed to B's site and B's site number and rate are copied into A's snapshot. The availability check runs against A's `propertyId`, so B's bookings are never consulted. | Filter the site lookup by `organizationId` + `propertyId`. |
| **H3** | **No status-transition rules.** Check-in accepts cancelled or checked-out reservations. Check-out accepts pending or cancelled ones and isn't idempotent (it overwrites the time). Cancel accepts checked-out reservations. PATCH can set any `status`, including `cancelled → confirmed`, **without an availability re-check**. | `reservation.service.ts:543-611, 535` | Reactivating a cancelled booking after its site was resold creates a double booking. Reports and guest stats become inconsistent. | A central transition table, enforced with atomic `findOneAndUpdate({_id, status:{$in:allowedFrom}})`. Re-check availability whenever a reservation re-enters an active status. |
| **H4** | **The payment ledger is unsafe.** It has no idempotency key, so a double-submit records the payment twice. Refunds aren't capped at the net amount paid. Payments are accepted on cancelled reservations. `guest.totalSpent` increases even for `pending`/`failed` payments. Currency is hardcoded to `USD`. `paidAmount` is recomputed with read-sum-save, so two concurrent payments can each miss the other. | `payment.service.ts:9-72` | Duplicate payments, a negative net balance, inflated guest lifetime value. | Add an idempotency key (unique index), validate refund ≤ net paid, compute totals with an atomic update or aggregation, and only count `completed` payments. |
| **H5** | **Multi-document writes aren't atomic.** Each booking writes the reservation, the payment, guest stats and discount usage as separate operations. | `reservation.service.ts:253-318`, `public-booking.service.ts:246-309` | If the process fails after the reservation insert, you get a "paid" booking with no payment row, or stats that have drifted. | Wrap the writes in one transaction (the same transaction as C1). |
| **H6** | **Public confirmation lookup leaks PII and can be enumerated.** It's unauthenticated and looks up by 5-character code globally (32⁵ ≈ 33.5M codes) with no rate limit. It returns the **entire guest document** (address, staff notes, VIP/blacklist flags, totalSpent) plus payments. Codes are unique only per org, so a code collision across orgs can return the wrong tenant's booking. | `public-booking.service.ts:349-376` | Scripted guessing harvests guest PII. | Longer random codes from `crypto`, a lookup scoped by slug plus code plus email or last name, a field allowlist on the response, and rate limiting. |
| **H7** | **Public booking can overwrite guest profiles.** It upserts the guest by email and returns the full guest document. Blacklisted guests aren't blocked. | `public-booking.service.ts:179-206, 341-346` | Anyone who knows a guest's email can overwrite that guest's name, phone and RV details, and the response shows them the guest's profile. | Don't overwrite an existing profile from the anonymous flow; store the submitted details on the reservation snapshot instead. Check `isBlacklisted`. Return an allowlist of fields. |
| **H8** | **No role-based access control.** `requireRole` exists but no route calls it. | all 51 handlers | Any staff user can refund, delete sites, change rates, mass-email every guest, and schedule full guest exports to any outside address. (Today only owners exist, because there's no user-management API, but this becomes live as soon as staff accounts are added.) | Add a role matrix, starting with refunds, deletes, rates, broadcasts, exports and settings. |
| **H9** | **Sessions can't be revoked.** JWTs last 7 days and `requireAuth` never checks the database. The token is also returned in the JSON body. | `jwt.ts`, `session.ts`, `auth.service.ts:176,254` | Deactivated users keep access for up to 7 days. Role changes don't take effect. Logout doesn't invalidate the token. Any XSS can steal the token from the response body. | Add a `tokenVersion`/`isActive` check (cached briefly), stop returning the token in the body, and use shorter-lived tokens. |
| **H10** | **Error mapping is wrong.** Service `ValidationError`s, Mongoose `ValidationError`/`CastError` and the `BSONError` from an invalid ObjectId all become **500s**. Classification also relies on substring matching (`"not found"`). Every 500 echoes the raw internal `err.message`. | `api-response.ts:51-80` | `/api/sites/abc` returns a 500 with internal text instead of a 404. | Use typed error classes, `isValidObjectId` checks, and a generic message for 500s. |
| **H11** | **Scheduled exports have no atomic claim.** `nextRunAt` is advanced only after the workbook is built and emailed. | `export.service.ts:740-757` | Overlapping cron runs, or a retry, send the same report twice. | Claim each schedule with `findOneAndUpdate` and a lock (advance `nextRunAt` first). |
| **H12** | **HTML injection in every email template.** No interpolated value is escaped. | `lib/mail/templates.ts` (guest name, add-on names, broadcast subject/body) | An anonymous booker puts a phishing link in their name and it renders inside a branded confirmation email. | An `escapeHtml()` helper applied to every interpolation. |
| **H13** | **Revenue reports count refunds as revenue.** The `days` parameter is also unvalidated, and occupancy is computed from reservations *created* in the window rather than nights *stayed* in it. | `report.service.ts:28-65`, `app/api/reports/route.ts:10` | Wrong financials. `days=abc` returns a 500. `days=100000` loads everything into memory. | Subtract refunds. Validate `days` (1–366). Compute occupancy from stayed nights with an aggregation pipeline. |
| **H14** | **Export files are stored inside the Mongo document, and the on-demand response may include the whole file.** `fileBufferBase64` lives on the document (16MB limit, no TTL). The `job` object returned by `create` likely still contains it. | `export.service.ts:294`, `on-demand/route.ts:38` | Large exports fail only after all the work is done; the JSON responses are huge. | GridFS or object storage, a TTL index, and a field projection on the response. |

## 3. Medium

| ID | Finding |
|---|---|
| M1 | **Discount rules aren't enforced.** `validFrom`/`validUntil` are ignored. Percentage discounts over 100 are allowed. There's no usage cap. An invalid code is silently ignored. When a booking is edited, the discount is looked up again, so if it has been deactivated it silently disappears and the price goes up. A discount can't be removed either, because `""` falls back to the existing code (`reservation.service.ts:478-483`). |
| M2 | **Any edit (including a tape-chart drag) re-prices with the current tax rate and current discount state.** Historical bookings change price. Store `taxRatePercent` on the reservation. |
| M3 | **Booking rules aren't enforced.** `maxOccupancy`, rig length vs `maxRigLength` (only filtered in the public search, not checked when the booking is created), `petFriendly` and blacklist are never checked. `weekendBaseRate` is stored but never used in pricing. Bookings can be made for past dates. There is no min or max stay. |
| M4 | **Timezones.** The dashboard's "today" (arrivals, departures, revenue) uses the UTC day rather than `Property.timezone`. For US parks, today's arrivals flip to tomorrow during the evening. Export schedules run on server-local time. Monthly schedules overflow short months (Feb 31 becomes Mar 3), and `hours || 8` turns 00:xx into 08:xx. |
| M5 | **Regex injection / ReDoS.** The `search` parameter is passed unescaped into case-insensitive `$regex` in the reservation, guest, payment and add-on lists. These queries also can't use indexes. |
| M6 | **Guest stats drift.** `totalStays` goes up when a reservation is created (even `pending`) and never goes down on cancel. `totalSpent` includes failed or pending payments. |
| M7 | **Duplicate guests are possible.** Guest uniqueness per org is check-then-insert with no unique index. A guest's email can be changed to one that already exists. |
| M8 | **Confirmation code generation.** Codes come from `Math.random` and uniqueness is checked with a sequential `findOne` loop. Use `crypto` plus the existing unique index, and retry on error 11000. |
| M9 | **Unbounded or overfetching queries.** `getGuestById` loads all reservations. The dashboard loads every active reservation just to sum balances in JS. Reports and exports load whole collections into memory. Tape chart and availability return full site documents. No projections are used on list endpoints. |
| M10 | **Public endpoints overexpose and have no throttling.** They return whole `property`/`site` documents (including internal `notes` and `organizationId`). There is no rate limiting on public booking (spam bookings can block inventory), login or register. |
| M11 | **Auth hygiene.** Login timing reveals which emails exist (bcrypt is skipped for unknown users). A login-alert email goes out on every login. Minimum password length is 6. Login picks an arbitrary property for multi-property orgs. |
| M12 | **Broadcasts are fragile.** Emails are sent synchronously inside the request at 20 in parallel, which exceeds Resend's rate limit. The `Broadcast` record is written only after sending finishes, so a timeout followed by a retry re-sends to everyone. An empty audience silently emails staff instead. `audience-count` returns guest emails to any role. |
| M13 | **Exports load entire collections and build the workbook in memory.** Memory/timeout risk for large parks. Use projections and streaming writers. |
| M14 | **Ephemeral database in staging.** `connectDB` silently uses an in-memory MongoDB whenever `MONGODB_URI` is missing and `NODE_ENV !== "production"`, so a misconfigured staging environment loses its data on every restart. `mongodb-memory-server` is also in `dependencies` rather than `devDependencies`. |

## 4. Low

- **L1.** `deleteSite` counts active reservations without a tenant filter, and compares against the current time instead of a date-only value.
- **L2.** `checkAllSitesAvailability` keeps only the last conflict per site.
- **L3.** The `refunded` payment status is never used. No cancellation email and no refund workflow on cancel.
- **L4.** Placeholder data is written into real records: registration hardcodes a fake street address on every new property.
- **L5.** Scratch scripts in git send live email to hardcoded personal and third-party addresses, and `tests/mail-broadcast.test.ts` sends real emails when the API key is set.
- **L6.** Schedule update and delete write no audit log, and `lastError` is never cleared.
- **L7.** Lint errors (229), mostly `any`.

## 5. MongoDB index review (static; Phase 3 confirms with `explain()`)

**Redundant indexes.** Each one costs write overhead and RAM without serving any query.

- **Reservation:** single-field indexes on `organizationId`, `propertyId`, `siteId`, `guestId`, `checkInDate`, `checkOutDate`. All are covered by compound-index prefixes or unused.
- **Site:** `organizationId`, `propertyId`, `siteTypeId`.
- **Guest:** `propertyId`, `email`, `phone` (all covered by the `{organizationId, …}` compounds).
- **Payment:** `organizationId`, `propertyId`.
- **AddOn:** `organizationId`, `propertyId`, `category`, `isActive`.
- **ExportSchedule:** `isActive`, `nextRunAt`.
- **Declared twice:** `User.email`, `Organization.slug` and `Property.slug` each declare both `unique` and `index`.

**Missing indexes, based on the queries actually issued.**

| Collection | Proposed index | Serves |
|---|---|---|
| Reservation | `{propertyId:1, status:1, checkInDate:1}` | Dashboard arrivals/upcoming, export filters |
| Reservation | `{propertyId:1, status:1, checkOutDate:1}` | Departures, on-site list |
| Reservation | `{propertyId:1, createdAt:-1}` | Recent reservations, reports, exports |
| Reservation | `{organizationId:1, confirmationCode:1}` unique — **exists**; public lookup must use it (H6) | — |
| Guest | `{organizationId:1, email:1}` **unique** (dedupe existing rows first) | M7 |
| Guest | `{propertyId:1, updatedAt:-1}` | Guest list sort |
| Payment | `{reservationId:1, status:1}` | Ledger recompute |
| Payment | `{idempotencyKey:1}` unique, sparse | H4 |
| ExportJob | TTL on `completedAt` | H14 |

**Already well served:**

- The availability overlap query, by `{siteId, checkInDate, checkOutDate, status}`.
- The reservation list sort, by `{propertyId, checkInDate, checkOutDate}`.
- The payment list, by `{propertyId, createdAt}`.

**Connection:** the global cached promise and `maxPoolSize:10` are appropriate for serverless.

## 6. Caching assessment (input to Phase 4)

There is currently no caching anywhere. Candidates that are worth it and safe:

- **Property-by-slug** on the public flow: read on every public request, changes rarely. Invalidate on property update.
- **Active add-ons and site list per property:** short TTL, invalidated on site and add-on writes.
- **Dashboard and report aggregates:** 30–60 second per-property TTL.

**Never cache:** availability, the overlap check, or anything read inside a booking transaction.

Redis isn't justified yet. An in-process LRU or Next `unstable_cache` with tags is enough until there are multiple instances.

## 7. Recommended fix order (Phase 8)

1. **Security:** C4, C6, C7, C5, H2, H12, H10, then H8 and H9.
2. **Booking and payment correctness:**
   - Atomic booking: C1 and H5 (transactions).
   - Server-side pricing: C2.
   - C3, once you decide how payment should work.
   - H3, H4, H1, H13.
3. **Data integrity:** M1–M3, M6, M7, H11.
4. **Indexes and query optimization:** §5, M9, M5.
5. **API performance:** projections, aggregations, payload trimming.
6. **Caching:** §6.
7. **Quality:** lint, typed errors, removing the scratch scripts.

**Test harness, set up before the first fix:**

- **Vitest** with `MongoMemoryReplSet`, so transactions are real in tests.
- **Route-handler integration tests** that call the exported `GET`/`POST` functions directly.
- **Playwright** for end-to-end flows.
- **autocannon** for load tests, including the concurrent double-booking test that must fail on today's code and pass after the C1 fix.

Each fixed bug gets a regression test.

## 8. Decisions needed before Phase 8

1. **Online payments (C3):** integrate a real gateway (Stripe, or another provider), or record online bookings as `pending` with the full balance due until staff collect payment?
2. **Production MongoDB:** is it a replica set (for example Atlas)? The C1 and H5 fixes depend on multi-document transactions.
3. **Roles (H8):** confirm the intended matrix. Proposed default: staff handle reservations, check-in/out and payments; manager adds refunds, sites, rates and add-ons; owner adds broadcasts, exports and settings.

---

# Phase 8, round 1: fix log (2026-11-11)

**Defaults applied for the §8 decisions** (each can be reversed):

1. **Online payments:** online bookings are recorded honestly as `confirmed` with the full balance due. No payment is fabricated.
2. **MongoDB:** double booking is prevented with a per-site lease lock built on single-document atomic upserts. It works on both standalone and replica-set MongoDB.
3. **Roles:**
   - **Staff:** reservations, check-in/out, guests, payments.
   - **Manager:** everything staff can do, plus refunds, sites, site types, add-ons and reports.
   - **Owner:** everything, plus exports and broadcasts.

## Verification

| Check | Before | After |
|---|---|---|
| Automated tests | 0 runnable (`console.assert` scripts) | **71 passing** (Vitest + in-memory MongoDB): 8 files, unit + integration + route-handler level |
| Concurrent booking test (15 parallel, same site/nights) | **15 / 15 succeeded** (double booking reproduced) | 1 / 15 succeeded, 14 × 409 |
| Concurrent drag-and-drop onto the same slot | 2 / 2 succeeded | 1 / 2 |
| `tsc --noEmit` | pass | pass |
| `eslint` errors | 229 | 214 |
| `next build` | not run | pass |
| HTTP smoke test on `next start` (production build) | — | pass: register → cookie session → site → booking → 409 on overlap → idempotent payment → public booking priced from catalog → confirmation allowlist → cron 401/200 → logout 401 |

## Changes by finding

| ID | Fix | Main files | Regression test |
|---|---|---|---|
| C1 | Per-site lease lock serializes the availability check and the write, in create, update/drag-and-drop and public booking | `lib/booking/site-lock.ts` (new collection `site_booking_locks`), `services/reservation.service.ts`, `services/public-booking.service.ts` | `booking-concurrency.test.ts` |
| C2 | Public add-ons are priced from the catalog (`addOnId` + quantity only; must be active and in this property) | `public-booking.service.ts` | `public-booking.test.ts` |
| C3 | No fabricated payment. Online bookings record paid 0 with the full balance due. The confirmation page now shows Total / Paid / Balance Due | `public-booking.service.ts`, `app/book/[slug]/confirmation/[code]/page.tsx` | `public-booking.test.ts` |
| C4 | JWT secret is resolved lazily and must be ≥32 chars in production; HS256 is pinned | `lib/auth/jwt.ts` | `routes-security.test.ts` |
| C5 | Removed the slug → "first property" fallback | `public-booking.service.ts` | `public-booking.test.ts` |
| C6 | Cron requires `Authorization: Bearer $CRON_SECRET` (timing-safe compare, fails closed) | `lib/auth/cron.ts`, `app/api/cron/exports/route.ts` | `routes-security.test.ts` |
| C7 | Removed the hardcoded reroute inbox. Sandbox reroute only outside production with an explicit `RESEND_TEST_EMAIL`; attachments are never forwarded; a reroute is reported as not delivered; recipient addresses are no longer logged | `lib/mail/resend.ts`, `services/communication.service.ts` | — |
| H1 | Update schemas no longer inject defaults (`toUpdateSchema`). Nested PATCHes use dot-path `$set`. Also fixed the same bug in the export-schedule toggle | `lib/validations/update-schema.ts`, `lib/utils/flatten.ts`, the four schema files, `guest/site.service.ts` | `update-schemas.test.ts` |
| H2 | Site lookup on reservation update is tenant-scoped | `reservation.service.ts` | `reservations.test.ts` |
| H3 | Status transition table. Check-in, check-out and cancel are atomic conditional updates and idempotent. Reactivation re-checks availability | `lib/booking/status.ts`, `reservation.service.ts` | `reservations.test.ts` |
| H4 | Idempotency key (unique partial index, sent by `PaymentModal`). Atomic `paidAmount`/`balanceDue` update. Refunds capped at net paid, safe under concurrency. Only `completed` payments count. Property currency used. No new payments on cancelled reservations | `payment.service.ts`, `models/Payment.ts`, `components/payments/PaymentModal.tsx` | `payments.test.ts` |
| H5 | Reservation is removed if the initial payment insert fails (compensation, not a transaction) | `reservation.service.ts` | — |
| H6 | Confirmation codes: 8 chars from a CSPRNG (was 5 chars from `Math.random`). Lookup scoped by slug. Responses field-allowlisted. Rate limited | `lib/utils/code-generator.ts`, `lib/booking/public-dto.ts`, confirmation route and page | `public-booking.test.ts`, `routes-security.test.ts` |
| H7 | Anonymous bookings never overwrite an existing guest profile; blacklisted guests are refused | `public-booking.service.ts` | `public-booking.test.ts` |
| H8 | Role guards on all write/admin routes; refunds need a manager or owner | `lib/auth/session.ts` (`ROLES`), 16 route files | `routes-security.test.ts` |
| H9 | Each request re-checks that the user exists and is active, and takes the role from the database (30 s per-instance cache). The token is no longer returned in the JSON body or stored in `localStorage` | `lib/auth/session.ts`, login/register routes, `hooks/useAuth.tsx`, `lib/axios/client.ts` | `routes-security.test.ts` |
| H10 | Typed errors. Invalid IDs → 400, malformed JSON → 400, validation → 422, 500s return a generic message | `lib/utils/errors.ts`, `lib/utils/api-response.ts` | `routes-security.test.ts` |
| H11 | Cron claims each schedule with an atomic compare-and-set before running it; failures are recorded without saving a stale document | `services/export.service.ts` | — |
| H12 | Every template input is HTML-escaped | `lib/mail/templates.ts` | `mail-templates.test.ts` |
| H13 | Refunds are subtracted. `days` is clamped to 1–366. Occupancy counts nights stayed in the window. Aggregation runs in MongoDB; days use the park's local calendar | `services/report.service.ts`, reports route | `payments.test.ts` |
| H14 (partial) | The on-demand export response no longer includes the base64 file | `export.service.ts` | — |
| M1 | Discount validity window enforced; invalid code returns an error; value capped at 100%; discount terms frozen on the reservation; `""` removes the discount | `lib/booking/discount.ts`, `lib/utils/pricing.ts`, `reservation.service.ts` | `reservations.test.ts` |
| M2 | Tax rate frozen on the reservation (`taxRatePercent`) | `models/Reservation.ts`, `reservation.service.ts` | `reservations.test.ts` |
| M3 (public flow) | Past dates, stays over 365 nights, oversized rigs and pets on non-pet sites are rejected; search filters pet-friendly sites | `public-booking.service.ts` | `public-booking.test.ts` |
| M4 (dashboard and reports) | "Today" and daily buckets use the property timezone (DST-aware `Intl` helpers) | `lib/utils/date.ts`, `dashboard.service.ts` | `pricing-and-dates.test.ts` |
| M5 | Search input escaped and length-capped in all four list endpoints | `lib/utils/regex.ts` | `reservations.test.ts` |
| M6 | Cancel decrements `totalStays`; status transitions keep the counter consistent | `reservation.service.ts` | `reservations.test.ts` |
| M7 (partial) | Guest email-change collision check. Admin guest upsert is a single atomic call | `guest.service.ts`, `reservation.service.ts` | — |
| M8 | Confirmation-code collisions are handled by unique index + retry | `reservation.service.ts` | — |
| M9 (partial) | Dashboard sums run as aggregations; list projections; guest history capped at 200; availability check uses `exists()` | `dashboard.service.ts`, `reservation.service.ts`, `guest.service.ts` | — |
| M10 (partial) | Public responses allowlisted. In-process rate limits on public booking, confirmation, availability, login and register | `lib/utils/rate-limit.ts` | `routes-security.test.ts` |
| M11 (partial) | Constant-time login (dummy bcrypt hash); register minimum password length 8 | `auth.service.ts`, `auth.schema.ts` | — |
| M14 | The in-memory DB fallback applies only when `NODE_ENV` is `development`/`test` or `ALLOW_IN_MEMORY_DB=true` | `lib/db/connection.ts` | — |
| L1 | `deleteSite` reservation check is tenant-scoped | `site.service.ts` | — |
| L2 | Availability reports the earliest conflict per site | `reservation.service.ts` | — |
| Deprecations | Mongoose 9 `new` option → `returnDocument`; pipeline updates pass `updatePipeline: true` | services | full suite |

**Indexes added (each serves a specific query):**

- Reservation `{propertyId, status, checkInDate}`: dashboard arrivals/upcoming.
- Reservation `{propertyId, status, checkOutDate}`: departures/on-site.
- Reservation `{propertyId, createdAt: -1}`: recent bookings, reports, exports.
- Payment `{reservationId, status}`: folio/ledger.
- Payment `{organizationId, idempotencyKey}`: unique, partial.

**Index removed:** Reservation `{propertyId, status}`, a strict prefix of the new compound. Removing the schema declaration does not drop it from existing databases; drop it manually after confirming with `explain()`.

## Deployment actions required

1. **`JWT_SECRET` must be ≥32 characters in production**, or every login fails. Rotating it logs everyone out once.
2. **Set `CRON_SECRET`** (≥16 chars) and configure the cron caller to send `Authorization: Bearer <secret>`. Until then, scheduled exports stop: the endpoint fails closed.
3. **`MONGODB_URI` is required** anywhere `NODE_ENV` isn't `development`/`test`.
4. **Resend:** verify your sending domain. The sandbox reroute is now off in production, and in development it needs `RESEND_TEST_EMAIL`.

## Behaviour changes users will notice

- **Online bookings** show "Balance Due at Park" instead of "Total Paid".
- **Invalid or expired discount codes** now return an error instead of being silently ignored.
- **Public search and booking** enforce rig length and pet-friendly rules and reject past dates.
- **Confirmation codes** are now `RV-XXXXXXXX` (8 chars). Old 5-char codes still resolve.
- **Staff and manager accounts** (none exist yet) are restricted per the role matrix.

## Still open (next rounds)

- **Broadcasts (M12):** queue them, write the record before sending, use Resend's batch API with an idempotency key, and throttle.
- **Exports:**
  - Move files to GridFS or object storage with a TTL (H14).
  - Stream workbooks with projections (M13).
  - Compute schedule times in the property timezone, fix month overflow and `hours || 8` (M4).
- **Staff-entered add-on prices** are still trusted. This is intentional so desk staff can override prices; confirm you want that.
- **Transactions:** reservation + payment + counters are compensated, not transactional. Upgrade to transactions once a replica set is confirmed. The lease lock assumes each critical section finishes within 15 s.
- **Unique `{organizationId, email}` index on guests** needs a dedupe migration first (M7).
- **Rate limits are per-instance**; back them with Redis/Upstash for multi-instance deployments.
- **Phase 2/3 (not started):** `explain()` plans and timings on a seeded dataset, then removing redundant single-field indexes.
- **Phase 4:** caching. **Phase 7:** Playwright E2E and load tests (autocannon).
- **Scratch scripts and the legacy `tests/*.test.ts` scripts** still contain a personal email address and send live mail. They're excluded from Vitest; delete them or move them out of git.
- **Login alert email** is still sent on every login (unchanged).

---

# Phase 8, round 2: fix log (2026-11-11)

**Verification:**

- **Tests:** 98 passing across 12 files. One of them, `transactions-replset.test.ts`, runs against a real replica set.
- **Checks:** `tsc` passes. `eslint` errors 214 → 203. `next build` passes.
- **HTTP smoke test** on `next start`: broadcast returned immediately and was delivered by `after()` (sent 1/1); a retry with the same idempotency key returned 200 with no second broadcast; an export stored in GridFS downloaded as a valid xlsx; history contains no file data.

| ID | Fix | Main files | Test |
|---|---|---|---|
| H5 | `commitBooking`: the per-site lock wraps one multi-document transaction (reservation + payment + guest/discount counters) when the deployment is a replica set or Atlas, detected at runtime. Standalone MongoDB keeps a compensating delete. Confirmation-code retries wrap the whole transaction | `lib/db/transaction.ts`, `services/reservation.service.ts`, `services/public-booking.service.ts` | `transactions-replset.test.ts`, `reservations.test.ts` |
| M12 | **Broadcast rewritten:**<br>• The record is created as `queued` before any send.<br>• Delivery runs in `after()` (`maxDuration` 300), so a large audience can't time out the request.<br>• An atomic `queued → sending` claim means it runs once.<br>• Resend batch API: 100 per request, an idempotency key per chunk, paced under 2 req/s, retry with backoff on 429/5xx.<br>• Progress is saved after each chunk.<br>• An empty audience is rejected (it used to email staff silently).<br>• `in_house_campers` = guests on site today, in the park's timezone.<br>• Audiences use `distinct()`.<br>• Preview emails are masked; history is bounded and omits recipient lists.<br>• The UI sends an idempotency key and shows real delivery state | `services/communication.service.ts`, `lib/mail/resend.ts`, `services/mail.service.ts`, `models/Broadcast.ts`, broadcasts route, `BroadcastModal.tsx`, communications page | `broadcasts.test.ts` |
| H14 | Export files stored in **GridFS** (no 16MB limit, no base64 bloat). Legacy inline files still download. A retention purge (`EXPORT_RETENTION_DAYS`, default 30) runs with the cron job; it deletes the file and keeps the history row | `lib/storage/export-files.ts`, `models/ExportJob.ts`, `services/export.service.ts` | `exports.test.ts` |
| M13 | Exports load only the collections their report type needs. Counts are checked first against a 50,000-row cap per collection, so an oversized export fails fast instead of running out of memory. Failed exports are recorded as `failed` jobs | `services/export.service.ts` | `exports.test.ts` |
| M4 (exports) | Schedule times and report date ranges are computed in the property's timezone (DST-aware). `00:xx` is no longer turned into `08:xx`. Day-of-month clamps (31 → Feb 28). A rename no longer shifts the next run. Schedule update and delete write audit logs. `lastError` is set and cleared correctly. The on-demand and scheduled paths share one implementation (≈120 duplicated lines removed) | `services/export.service.ts`, `lib/utils/date.ts` | `exports.test.ts` |
| M7 | Unique `{organizationId, email}` index on guests, plus a migration that merges existing duplicates (re-points reservations and payments, sums counters, ORs flags, merges notes; supports a dry run) | `lib/migrations/dedupe-guests.ts`, `scripts/migrate-dedupe-guests.ts`, `models/Guest.ts` | `migrations.test.ts` |
| L5 | Removed `scratch/` and the legacy `tests/*.test.ts` scripts (they sent live email to hardcoded addresses). Their assertions are ported to Vitest. The personal address no longer appears in the working tree, but **it remains in git history** | — | `exports.test.ts`, `pricing-and-dates.test.ts` |
| Phase 3 | Index redesign (71 → 36 declared indexes) and query fixes; see `PHASE-2-3-PERFORMANCE.md` | models, services | full suite + benchmark |

**New tooling:**

- `npm run bench`: benchmark and explain harness.
- `scripts/sync-indexes.ts`: diffs the indexes declared in code against the database (dry run by default; `--apply` creates and drops).
- `scripts/migrate-dedupe-guests.ts`: merges duplicate guest profiles.
- `tsx`: dev dependency, used to run the scripts.

## Still open after round 2

- **Search count** scans the whole property (product decision; see the Phase 2/3 report).
- **Phase 4:** caching (dashboard and reports are the measured candidates).
- **Phase 7:** Playwright E2E and HTTP load tests (autocannon) are not written yet.
- **Rate limits are per-instance** (needs Redis/Upstash for multi-instance deployments).
- **Staff-entered add-on prices** are still trusted by design.
- **Login alert email** is still sent on every login.
- **Stuck broadcasts:** a broadcast stuck in `sending` after a crash isn't resumed automatically. Its stats show how far it got; resending is manual.

---

# Round 3 (2026-11-11): Phase 4 caching, Phase 7 E2E/load, remaining items

Details are in `PHASE-4-7-CACHING-TESTING.md`.

**Summary:**

- **Cache:** generation-invalidated, coherent across instances, with single-flight loading. Applied to the dashboard, reports and the public catalog, never to availability.
- **Search:** capped search count, plus an indexed fast path for confirmation codes.
- **Rate limits:** shared across instances via MongoDB.
- **Add-ons:** staff catalog add-ons are priced from the catalog.
- **Login alerts:** only for new devices.
- **Broadcasts:** stuck broadcasts are recovered by the cron job.
- **Dashboard payload:** bounded (1.78 MB → 75 KB; 17× throughput under load).
- **Tape chart:** projection trimmed (−14%).
- **New tests:** an HTTP E2E suite (12 workflows against the production build) and a load/soak harness.

**Results:**

- **Tests:** 119 unit/integration + 12 E2E, all passing.
- **Checks:** `tsc` clean, `next build` passes, eslint errors 203 (none added).

**New environment variables (all optional):**

- `SESSION_CACHE_TTL_MS` (default 30000)
- `DISABLE_CACHE`
- `EXPORT_RETENTION_DAYS`

**New npm scripts:** `test:e2e`, `bench`, `load`.
