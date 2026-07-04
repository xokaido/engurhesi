# engurhesi.ge

Full rebuild of the Enguri HPP corporate site: SvelteKit on Cloudflare Workers with D1, R2, Queues and the Images binding. Architecture and decisions live in [AGENTS.md](./AGENTS.md); visual/UX direction in [DESIGN.md](./DESIGN.md).

## Quick start (local development)

```bash
npm install
cp .env.example .dev.vars       # dev-only dummy secrets
npm run db:migrate:local        # apply D1 migrations
npm run db:seed:local           # trilingual sample content + admin user
npm run dev
```

Open **http://127.0.0.1:5199/ka** — root `/` redirects to `/ka`. Vite dev uses the Wrangler platform proxy for D1/R2/Queues/Images bindings.

**Admin panel:** http://127.0.0.1:5199/admin — seeded login `admin@engurhesi.ge` / `engurhesi-dev-2026`.

## What's here

| Area | Where |
|---|---|
| Public site (KA/EN/RU) | `src/routes/[locale=locale]/` — home, about, news, procurement, projects, media gallery, contact, search |
| Admin panel | `src/routes/admin/` — news, pages, procurement (status workflow + amendments + docs), projects, documents, media library, gallery/videos, partners, org chart, stats, glossary, inbox, jobs, settings, users, audit log |
| Server libraries | `src/lib/server/` — auth (PBKDF2 + sessions + CSRF), content queries with locale fallback, ProseMirror renderer/sanitizer, media quarantine pipeline, FTS5 search indexing, OpenRouter translation, edge cache + R2 snapshots |
| Worker entry | `worker/index.ts` — wraps the SvelteKit worker and adds the Queues consumer + hourly cron (session/token/submission cleanup, orphaned media) |
| Schema & migrations | `src/lib/server/db/schema.ts`, `migrations/` |
| Seed | `scripts/seed.mjs` (idempotent; regenerates `scripts/seed.generated.sql`) |

## Commands

```bash
npm run check            # svelte-check typecheck
npm test                 # vitest (renderer/XSS, auth, cache, media validation)
npm run build            # production build
npm run db:generate      # drizzle-kit migration from schema changes
```

## Deploy

```bash
npm run deploy:preview     # preview environment
npm run deploy:production
```

Before the first deploy: replace placeholder D1/R2 IDs in `wrangler.toml` with real resource IDs, and set secrets with `wrangler secret put` — `TURNSTILE_SECRET`, `SESSION_PEPPER`, `OPENROUTER_API_KEY`, plus `CF_API_TOKEN` / `CF_ZONE_ID` for purge-by-tag.
