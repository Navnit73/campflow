# Environments & database

## Which database is used?

**Only `MONGODB_URI` decides.** There is no silent fallback. Run `npm run db:check` to print the env files loaded, the database (credentials redacted), whether it's reachable, whether transactions are on, and document counts.

| Environment | How it runs | Database | Where the settings live |
|---|---|---|---|
| **Local** (your laptop) | `npm run db:local` + `npm run dev` | Real `mongod` 8.2 on `127.0.0.1:27017`, replica set `rs0`, data persisted in `./.data/mongo` | `.env.development` (committed defaults) + `.env.local` (your secrets, git-ignored) |
| **Dev / staging** (shared) | `next build && next start` on your host | A **separate** Atlas cluster or database, e.g. `campflow_dev` | Host's environment-variable settings, using `.env.example` as the checklist |
| **Production** | `next build && next start` | Production Atlas cluster | Host's environment-variable settings |
| Automated tests | `npm test`, `npm run test:e2e`, `npm run test:ui` | Throwaway in-memory / test replica set, created per run | Set by the test harness (`ALLOW_IN_MEMORY_DB=true` for UI tests) |

**Before this change:** no env files existed and `MONGODB_URI` was unset, so `next dev` silently used an **in-memory database that was wiped on every restart**. That fallback now requires `ALLOW_IN_MEMORY_DB=true`. Without a URI, the app refuses to start and tells you what to set.

## Local setup (first time)

```bash
npm install
npm run db:local          # terminal 1: starts persistent MongoDB (Ctrl+C to stop)
npm run dev               # terminal 2: http://localhost:3000
npm run db:check          # optional: confirm which DB you're on
```

- `.env.development` already points `MONGODB_URI` at the local database.
- `.env.local` holds generated `JWT_SECRET` / `CRON_SECRET`. To create your own, copy `.env.example` → `.env.local` and generate secrets with:

  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```

- To use a **shared dev cluster** instead of local Mongo, set `MONGODB_URI` in `.env.local` (it overrides `.env.development`).
- Reset local data: stop `db:local`, delete `./.data/mongo`, start it again.

## Dev / staging and production

Set these on the host. `NODE_ENV=production` makes the app validate them at startup.

| Variable | Required | Notes |
|---|---|---|
| `MONGODB_URI` | ✅ | Use a different cluster or database per environment. Never point dev at production data |
| `JWT_SECRET` | ✅ prod | ≥ 32 random characters. Different per environment |
| `NEXT_PUBLIC_APP_URL` | ✅ prod | e.g. `https://dev.yourapp.com`; used in email links. Inlined at build time, so rebuild after changing it |
| `CRON_SECRET` | for scheduled exports | ≥ 16 characters. The cron caller sends `Authorization: Bearer <secret>`. Unset = endpoint disabled |
| `RESEND_API_KEY` | to send email | Empty = emails are logged only (recommended for dev unless testing mail) |
| `RESEND_FROM_EMAIL` | ✅ prod if sending | A verified sender domain |
| `RESEND_TEST_EMAIL` | dev only | Sandbox inbox; ignored in production |
| `SESSION_CACHE_TTL_MS`, `EXPORT_RETENTION_DAYS`, `DISABLE_CACHE` | optional | See `.env.example` |

**After pointing an environment at a database with existing data, run once:**

```bash
MONGODB_URI=... npx tsx scripts/migrate-dedupe-guests.ts --dry-run   # then without --dry-run
MONGODB_URI=... npx tsx scripts/sync-indexes.ts --apply
MONGODB_URI=... npx tsx scripts/migrate-search-tokens.ts
```

## No hard-coded business data

- **New parks start empty:** no invented description, amenities, rules, policies, tax rate, address or site types. The owner enters these in **Settings** and **Sites**.
- **Timezone** comes from the registering browser and is editable in Settings.
- **Forms** pre-fill only neutral starting values (e.g. 2 adults, gravel surface). Prices, amenities and policies start blank.
- **Starter templates carry no prices.** In **Services → Starter List** and **Sites → Choose from Templates** (`lib/onboarding/templates.ts`), the owner ticks what their park offers and must enter their own price or nightly rate for each item before it can be saved. Items that already exist are skipped.
- **The dashboard setup checklist** (owners and managers) is computed from real data:
  - required: address; confirmed tax rate and check-in/out times; ≥ 1 site category; ≥ 1 bookable site;
  - optional: cancellation policy, services;
  - then the shareable booking link.
- The 13:00 / 11:00 check-in/out defaults are flagged in Settings as "not yet confirmed" until the owner saves.
