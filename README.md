# CampFlow — campground & RV park management

Next.js 16 + MongoDB (Mongoose 9).

## Quick start (local)

```bash
npm install
npm run db:local     # terminal 1 — persistent local MongoDB (replica set, data in ./.data/mongo)
npm run dev          # terminal 2 — http://localhost:3000
npm run db:check     # shows which database you're connected to
```

The database is chosen **only** by `MONGODB_URI`:

- **Local:** `.env.development` points it at the database from `npm run db:local`.
- **Your secrets:** go in `.env.local` (git-ignored). Copy `.env.example` to `.env.local` to start one.
- **Other environments:** dev/staging and production are set on the host.

See **[docs/ENVIRONMENTS.md](docs/ENVIRONMENTS.md)** for setup.

New parks start empty. Register, then enter your address, tax rate and policies in **Settings**, and create site categories and sites in **Sites**.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:local` | Local persistent MongoDB 8.2 (no install needed) |
| `npm run db:check` | Prints env files loaded, the database URI (redacted), reachability and transactions |
| `npm test` | Unit and integration tests (real `mongod`) |
| `npm run test:e2e` | Builds, then runs HTTP workflow tests against `next start` + a replica set |
| `npm run test:ui` | Builds, then runs Playwright browser journeys |
| `npm run bench` | Query and latency benchmark on a seeded 80k-reservation dataset |
| `npm run load` | HTTP load and soak test against the production build |
| `npm run typecheck` / `lint` | TypeScript and ESLint |

**Maintenance scripts:** `scripts/sync-indexes.ts`, `scripts/migrate-dedupe-guests.ts`, `scripts/migrate-search-tokens.ts`. See `docs/audit/FINAL-REPORT.md` for the deployment checklist.

## Docs

- `docs/ENVIRONMENTS.md`: environments, database selection, env variables
- `docs/audit/`: audit, fix logs, performance and test reports
