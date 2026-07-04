# AGENTS.md — engurhesi.ge Rebuild: Technical & System Plan

*Revision 3 — incorporates REVIEW_GPT_v1.md and REVIEW_GPT_v2.md. Architecture unchanged; v2's execution-level findings are resolved as explicit decisions below. Phase 0 is a hard gate: it must prove the difficult production behaviors, not just that SvelteKit runs on Workers.*

## 1. Stack decision

| Concern | Choice | Why / constraints |
|---|---|---|
| Framework | **SvelteKit** (not bare Svelte + Vite) | File-based routing, SSR, form actions, `+server.ts` API routes on the official `@sveltejs/adapter-cloudflare`. |
| Runtime | **Cloudflare Workers** | Single Worker for SSR, API, admin. Bulk/background work goes to Queues (§9), never one HTTP request. |
| Database | **Cloudflare D1** (SQLite) + Drizzle ORM | Tiny content volume (~150 entities). D1 processes queries serially — fine because public reads are edge-cached; all listing/lookup queries indexed and top routes benchmarked before the perf budget is declared met. Read replication not assumed. |
| Files/media | **Cloudflare R2** (private bucket) | Served only through the Worker's `/media/*` routes — the safety boundary is the app, not the bucket (§7). |
| Edge cache | **Workers Cache API + Cache-Tag purge** | Per-edge cache (not globally replicated; no native `stale-while-revalidate`). **Freshness comes from purge-on-publish, not short TTLs**; render-failure fallback comes from R2 HTML snapshots (§2.1–2.2). |
| Images | **Images binding, transforming R2 bytes** (decided — see §7.2) | Fixed preset allowlist; transformed responses explicitly stored in the Cache API (the binding does not auto-cache). |
| Auth (admin) | **Built-in password login** — PBKDF2-SHA256 (WebCrypto), D1 sessions, httpOnly cookies, **TOTP mandatory for every publish-capable account at launch** | Self-contained. `draft_editor` role exists for non-2FA contributors who cannot publish (§5). |
| Anti-spam | **Cloudflare Turnstile**, validated server-side (siteverify) on login and contact | Client widget alone is not protection. |
| Rich text | **TipTap, stored as ProseMirror JSON** (canonical, versioned via `content_schema_version`), HTML derived by a strict allowlist renderer | Makes sanitization (§6) and translation (§8) safe on Workers; renderer package proven under Workers in Phase 0. |
| Translation | **OpenRouter → Gemini 3.1 Pro class** — live id verified at build (currently `google/gemini-3.1-pro-preview`); fallback model configured; providers filtered to structured-output support | One structured-output request returns **EN + RU together**; long entities chunk by segment groups, still both locales per call (§8). Cheaper model allowed for archive backfill if fixture tests pass. |
| Search | **SQLite FTS5 in D1** — scoped as **basic multilingual search** | `unicode61`, no KA/RU stemming (accepted explicitly); index maintained transactionally with content writes (§10). |
| Video | **Range-aware R2 proxy route**, facade on the client | Separate contract from images/documents (§7.3). Cloudflare Stream is the upgrade path if volume grows. |
| Logging | **Workers Logs (durable) + Logpush to R2 for retention; alerting via Cloudflare notifications** | Named sink, structured events, PII redacted (§12.5). `wrangler tail` is a debugging tool, not the logging system. |

Optional later: Email Workers/Resend for contact-form forwarding to `info@engurhesi.ge`.

## 2. Architecture

```
Browser ──> Cloudflare edge
             ├── static assets (Vite build, immutable, cached forever)
             ├── per-edge Cache API hit? → cached SSR HTML (tagged)
             └── Worker (SvelteKit)
                  ├── public routes → D1 → HTML → cache.put(Cache-Tag) + async R2 snapshot
                  │     └── render failure → serve R2 snapshot (stale, flagged) or controlled 503
                  ├── /media/img/{key}/{preset} → Images binding over R2 bytes → Cache API
                  ├── /media/file/{key}         → R2 (documents; attachment/inline policy §7.1)
                  ├── /media/video/{key}        → R2 with Range/206 pass-through (never cached)
                  ├── /api/*  → JSON (stats etc.)
                  └── /admin/* → session-auth SSR admin (password + TOTP)
                       ├── D1 (write) + R2 (upload via quarantine) + scoped tag purge
                       ├── OpenRouter (translations; bulk via Queues)
                       └── Queues (jobs/job_items, dead-letter) + cron
```

### 2.1 Route-level cache policy

| Route family | Cached? | Cache key | Freshness TTL | Fallback retention | Tags |
|---|---|---|---|---|---|
| Home, listings, detail pages | Yes | locale + path + normalized pagination | **7 d safety cap; real freshness = purge-on-publish** | R2 snapshot, kept until next successful render (no expiry) | `home`, `news`, `news:{id}`, `proc`, `proc:{id}`, `page:{id}`, … |
| `/api/stats`, `sitemap.xml`, `robots.txt` | Yes | path | 1 h / until purge | R2 snapshot | `stats`, `sitemap` |
| `/media/img/*` | Yes (explicit `cache.put`) | key + preset | Immutable (1 y; content-addressed keys) | n/a | `media:{id}` |
| `/media/video/*` | **No** (`206` responses must not be `cache.put`) | — | — | — | — |
| Search | No | — | — | — | — |
| `/admin/*`, previews, POSTs, contact | **Never** (`no-store`) | — | — | — | — |

Hard rules: responses carrying `Set-Cookie` are never written to the public cache; cached pages vary only on locale + path + approved params; unknown query params are stripped from the cache key.

### 2.2 Stale/failure strategy (decided)

The Workers Cache API cannot serve expired entries, so stale behavior is designed, not assumed:

1. **Primary freshness = long TTL + tag purge.** Pages cache for 7 days; publishing purges affected tags. TTL is only a safety cap.
2. **Render-failure fallback = R2 HTML snapshots.** Every successful public render (or publish) asynchronously writes the full HTML to R2 (`snapshots/{locale}{path}`). If D1/rendering fails, the Worker serves the snapshot with a `x-served-stale: 1` header and logs/alerts; if no snapshot exists, a controlled, non-cached 503 page.
3. **Phase-0 proof**: a test forces D1 failure after cache expiry and asserts the snapshot is served; a second asserts the 503 path.

## 3. Data model (D1 / Drizzle)

Multilingual pattern: language-neutral row + `*_i18n` row per locale (`ka` required and **always the controlling source**; `en`/`ru` optional → UI falls back to KA with a notice).

**Conventions on every editable entity** (implied below): `created_at`, `updated_at`, `created_by`, `updated_by`, optimistic-lock `version`. Rich text: `body_json` (ProseMirror, with `content_schema_version`) + derived `body_html` and `body_text`, regenerated server-side on save. Every `*_i18n` row carries translation metadata: `review_status` (`missing` | `machine` | `human_edited` | `reviewed`), `stale_source` (set when KA `source_hash` changes materially), `translation_model`, `translation_provider`, `source_hash`, `prompt_version`, `translated_at`, `reviewed_at`, `reviewed_by`.

```
locales: ka (source), en, ru

-- auth & accountability
users            id, email, name, role (admin | editor | draft_editor),
                 password_hash, password_salt,
                 totp_secret_enc (encrypted with a key from Wrangler secrets, not stored
                 in D1 plaintext; required for admin + editor), recovery_codes_hashed,
                 failed_logins, locked_until
sessions         id (token hashed), user_id, created_at, last_seen_at (throttled ≤1/5min),
                 idle_expires_at, absolute_expires_at, ip, user_agent
reset_tokens     id, user_id, token_hash, expires_at, used_at
audit_log        id, actor_id (nullable → 'system'), action, entity_type, entity_id,
                 reason (required for procurement status/deadline changes),
                 detail_json, created_at
                 -- includes 2FA enrollment/reset, upload validation results,
                 -- translation runs, procurement status transitions

-- content revisions (recovery, not just accountability)
content_revisions id, entity_type, entity_id, locale, version, title, body_json,
                  derived_hash, status_at_save, actor_id, created_at
                  -- snapshot on every save and publish; admin UI: view + restore-as-draft
                  -- retention: ≥ backup window; indefinite for procurement/legal pages

-- media
media            id, r2_key, kind (image|document|video), declared_mime, detected_mime,
                 size, width, height, original_filename, checksum, focal_x, focal_y,
                 placeholder_color,
                 status (pending | active | rejected | orphaned)   -- quarantine, §7.1
media_i18n       media_id, locale, alt, caption, credit

-- content
pages / page_i18n              (as conventions above; + section, sort, status, published_at,
                                seo_title, seo_description)
articles / article_i18n        (+ category, cover_media_id, status, published_at, legacy_id,
                                excerpt, seo_description)
article_media                  article_id, media_id, sort
projects / project_i18n        (+ cover_media_id, sort, status, summary, facts_json)

procurements     id, slug, kind (tender|auction),
                 status (draft | published | deadline_passed* | closed | amended |
                         canceled | awarded | archived),
                 published_at, deadline_at (UTC; entered/displayed Asia/Tbilisi),
                 amends_id (→ parent notice for amendments), legacy_id,
                 migration_confidence
                 -- *deadline_passed is a COMPUTED public badge (deadline_at < now), not
                 --  an automatic status mutation, unless the organization confirms that
                 --  auto-closing is legally correct (open decision, §16)
procurement_status_history  procurement_id, from_status, to_status, actor_id, reason,
                            created_at
procurement_i18n procurement_id, locale, title, body_json/html/text,
                 amendment_summary, previous_deadline_at (for amendment notices)
procurement_docs id, procurement_id, media_id, locale (nullable = all), sort, revision
                 -- revisions are append-only; a PDF is never overwritten in place
procurement_docs_i18n  per-locale document titles

documents / document_i18n / document_files   (report library; per-locale PDF variants)
albums, album_items, videos (+ *_i18n)
partners / partner_i18n;  org_units / org_unit_i18n;  stats;  settings

-- translation support
glossary         id, term_ka, term_en, term_ru, note, version
                 -- pinned terminology, versioned together with prompt_version

-- operations
submissions      id, name, email, subject, message, ip_hash, ua_hash, created_at,
                 handled, purge_after (default +12 months)
redirects        old_path (UNIQUE), new_path, status_code (301|410), locale, note
jobs             id, type, status (queued|running|done|failed), payload_json,
                 progress (derived from job_items), created_at, created_by
job_items        id, job_id, idempotency_key (deterministic, UNIQUE per job), entity_ref,
                 status (queued|running|done|failed|dead), attempts, last_error,
                 result_json, started_at, finished_at
                 -- Queues consumer is idempotent per item; poison messages go to a
                 -- dead-letter queue and are marked status='dead' for admin inspection
search_index     FTS5 (entity, entity_id, locale, title, body_text), tokenize=unicode61
```

Indexes for every listing/lookup pattern: `(locale, slug)`, `(status, published_at)`, `(category, status, published_at)`, `(kind, status, deadline_at)`, `(year, category)`, `redirects.old_path`, `job_items.(job_id, status)`. Large blobs never live in D1.

**Migration discipline (D1-specific):** generated Drizzle migrations are inspected and run against **remote preview D1** before production; migrations that temporarily violate FK constraints use `PRAGMA defer_foreign_keys = true` (D1's documented mechanism — not the classic `foreign_keys = off`); one fixture migration altering a foreign-keyed table lives in the test suite; seed/import scripts are idempotent; expand/contract rule applies to all schema changes.

## 4. Admin panel (built for a non-technical editor)

Same SvelteKit app under `/admin`, Georgian-language UI. Guiding rule: **publish a news item in under 2 minutes with zero training.**

| Section | Capabilities |
|---|---|
| Dashboard | Shortcuts, drafts, procurement nearing/past deadline, contact submissions, job status |
| News | Filterable list → title, category, cover, rich text, gallery. **Draft → Preview → Publish**. "Restore previous version" from `content_revisions` |
| Procurement | Kind, deadline (Tbilisi time), append-only document revisions, amendments (linked notice + change summary + previous deadline), status transitions **with required reason**, all in `procurement_status_history`. Publishing procurement requires editor/admin role (never `draft_editor`) |
| Pages / Projects / Documents / Media / Partners / Org / Stats / Settings | As before; alt text required; per-locale PDFs; media shows validation status |
| Contact inbox | Read/mark-handled; auto-purged per retention policy |
| Users | Admin-only: roles, resets, 2FA reset (audit-logged) |

Editor UX: TipTap minimal schema; slugs auto-generated, locked after publish, changes auto-insert redirects; locale tabs KA / EN / RU with `review_status` chips (✓ reviewed, ✎ human-edited, ● machine, ○ missing, ⚠ stale — KA source changed since translation).

## 5. Authentication & security

- **Roles**: `admin` (everything), `editor` (publish content incl. procurement/legal), `draft_editor` (create/edit drafts only — cannot publish, cannot upload public files, cannot touch procurement/legal). **TOTP is mandatory at launch for every publish-capable account** (admin + editor); `draft_editor` exists precisely so low-friction accounts have no public blast radius.
- **TOTP hygiene**: secrets encrypted at rest with a key held in Wrangler secrets (not in D1); hashed one-time recovery codes; admin-initiated 2FA reset flow; enrollment/reset audit-logged. WebAuthn/passkeys are a welcome Phase-3+ addition for admins if implementation cost stays small.
- **Login**: email + password (PBKDF2-SHA256; iteration count benchmarked on Workers in Phase 0 — meaningful cost without login-flood DoS) + TOTP + server-side Turnstile.
- **Sessions**: 256-bit token stored hashed; httpOnly + Secure + SameSite=Lax; 12 h idle / 7 d absolute; `last_seen_at` written at most every 5 min; logout/password-change revoke server-side.
- **CSRF**: per-session token on all admin form actions (double-submit, verified server-side) + origin check.
- **Lockout**: per-account counter + `locked_until`; Cloudflare rate-limiting rule on `/admin/login`.
- **Audit**: every security event and every publish/unpublish/delete/status change.
- **Secrets**: `OPENROUTER_API_KEY`, `TURNSTILE_SECRET`, TOTP encryption key, purge-scoped CF API token, session pepper — `wrangler secret` only.

## 6. Rich text: storage, rendering, sanitization, evolution

1. **Canonical format: ProseMirror JSON**, validated on save against the exact TipTap schema (unknown nodes/marks rejected, not silently stripped). Document root carries `content_schema_version`.
2. **HTML is derived, never authored**: strict server-side renderer emits only allowlisted markup — links `http(s):`/`mailto:` only, images by media id only, no iframes/scripts/handlers/styles/unknown attributes. SVG is never treated as an image.
3. `body_text` derived in the same pass for search.
4. **Schema evolution**: renderer keeps fixture tests for every supported node/mark **per schema version**; when a node type is retired, the policy is render-fallback (safe generic rendering + admin warning), with a migration script when practical. Old documents must always render.
5. **XSS regression tests** (script injection, `javascript:` URLs, handler attributes, malformed JSON, legacy schema docs) gate CI. The renderer package's Workers compatibility and bundle size are proven in Phase 0.

## 7. Media pipeline

### 7.1 Upload safety (quarantine model)

- Presigned R2 PUT → `media` row created as **`pending`**. A server-side validation step then: checks **magic bytes** against the declared type (stores `detected_mime`), verifies size caps per type (images 15 MB — kept only if the §7.2 path proves it can transform that size, PDFs 50 MB, video by exception), computes checksum/dimensions/placeholder color, and flips the row to `active` or `rejected`. Only `active` media is servable or attachable. Validation results land in `audit_log` with uploader identity.
- **Serving policy**: all media responses get `X-Content-Type-Options: nosniff`. Images serve inline with the verified content type. **PDFs serve inline** (procurement UX) but under a tight `Content-Security-Policy: sandbox` response header and only after magic-byte validation; everything else (unknown/binary, XML, HTML-ish) serves `Content-Disposition: attachment`. User-uploaded SVG/HTML/XML is never served renderable.
- AV scanning for PDFs (uploaded by non-technical staff into a public procurement trail) is a **decision item** (§16): either an external scan API in the validation step or documented acceptance of the risk.

### 7.2 Images (exact mechanism — decided)

- **Mechanism: the Images binding transforming R2 object bytes**, not `fetch(cf.image)` — avoids public original URLs and loop-prevention routing entirely. Because binding output is **not auto-cached**, the route explicitly `cache.put`s transformed responses (key: `key + preset`, tag `media:{id}`, immutable TTL).
- Route: `GET /media/img/{key}/{preset}`, preset ∈ `thumb` (320) / `card` (640) / `content` (960) / `hero` (1600) / `original` + `@2x` variants; fit/quality/format fixed per preset server-side; anything else → 404. Billable variant space = presets × images.
- Documented in code: cache key, purge tag, **max input size** (validated against the binding's documented input limits in Phase 0 — the 15 MB upload cap shrinks if needed), billing unit (unique transformations), **local dev behavior** (binding unavailable in `wrangler dev` → passthrough original with a log marker), and failure response for unsupported formats (typed 415 + fallback to original where safe).
- Tests: pixel-level smoke test for every preset; assertions that arbitrary `?w=` values cannot mint variants.

### 7.3 Video (separate route contract)

- `GET /media/video/{key}`: passes through `Range` headers to R2, returns `206 Partial Content` correctly, sets `Accept-Ranges`, and **never `cache.put`s partial responses**. Phase 0 includes a Range-request test (seek + resume).
- Client keeps the facade pattern — no video bytes move until the user clicks. If video volume ever grows, the upgrade path is a public R2 custom domain for video only, or Cloudflare Stream.

## 8. Translation pipeline (KA → EN + RU)

- **What is sent**: extracted text segments only — title, excerpt, SEO description, ProseMirror text nodes with stable placeholder ids. Structure (marks, links, tables, media refs) is preserved by application code. Segment counts/ids validated on return; mismatches rejected and retried, never saved.
- **One call, all locales — with chunking**: the default is one OpenRouter request per entity returning `{en, ru}` via strict JSON Schema. **Long entities chunk by segment groups** (stable group boundaries, each chunk still translated into both locales in one call) so tables and long pages don't hit output limits. Fixture tests cover long pages and tables, not just short articles.
- **Terminology**: the `glossary` table (KA/EN/RU term triples) is injected into the prompt; glossary and prompt text are versioned together (`prompt_version`).
- **Review states**: per-locale `review_status` = `missing` → `machine` → `human_edited` → `reviewed`; a KA source edit that changes `source_hash` materially flips targets to `stale_source` (⚠ in the admin). Machine output never overwrites `human_edited`/`reviewed` content. **Legal, procurement, and policy content is never auto-marked `reviewed`; Georgian is the controlling version**, and the public site labels unreviewed machine translations (DESIGN.md).
- **Model management**: id verified at build against OpenRouter's catalog (currently `google/gemini-3.1-pro-preview`); fallback model configured; provider preferences require structured-output support; translate button degrades gracefully on outage.
- **Governance**: eligible = public/to-be-public editorial content. **Never sent**: contact submissions, user data, admin notes, credentials. Provider/model metadata stored per translation; monthly spend cap enforced by the job runner + alert.
- **Bulk backfill** runs as `jobs`/`job_items` through Queues (§9), chunked, idempotent, resumable; cheaper model class allowed for the archive if Phase-0 quality comparison passes, Pro-class reserved for institutional/legal pages.

## 9. Background jobs & cron

- **Model**: `jobs` (parent, derived progress) + `job_items` (one row per entity: deterministic `idempotency_key`, attempts, `last_error`, result, timestamps). Cloudflare Queues drives consumption; consumers are idempotent per item; poison messages go to a **dead-letter queue** and surface as `status='dead'` in the admin with a retry button.
- Used for: archive translation backfill, media re-validation/re-encode, sitemap rebuild, bulk purge, export triggers.
- **Cron** (Worker scheduled): hourly — recompute procurement deadline badges (and, only if auto-close is approved in §16, perform audited status flips), purge affected tags, rebuild sitemap if dirty; daily — expire sessions/reset tokens, enforce `submissions.purge_after`, mark orphaned media.

## 10. Search

FTS5 (`unicode61`) over title + `body_text` per locale — **basic multilingual search**, honestly scoped (no KA/RU stemming; prefix indexes; trigram companion only if fixtures show substring need).

**Index lifecycle (decided)**: maintained by **explicit application writes in the same logical transaction** as content save/publish (D1 batch) — no SQLite triggers. Unpublish/delete removes the rows in the same batch. Tests cover: stale results after edit, after unpublish, and locale-fallback behavior. FTS table size is measured after initial import and after the RU backfill. Ranking: entity-type boost (procurement, pages above archived news) + recency tiebreak.

## 11. Migration plan (old → new) — the #1 delivery risk

1. **Crawl & snapshot** — walk the live site's sitemap page + news pagination (both locales); raw HTML snapshots + media with checksums stored in R2 (offline copy survives cutover).
2. **Manifest** — one row per crawled URL: status, detected content type, legacy id, target entity/id, media refs, redirect target. The manifest is the QA artifact.
3. **Transform with fixtures** — parser built against fixture files from real pages (auctions/tenders, reports, projects, albums, EN-fallback pages). Procurement status inferred + flagged via `migration_confidence`; **all active/recent procurement manually reviewed**.
4. **Load** — media through the same quarantine/validation pipeline as uploads; JSON → D1 seed (idempotent); `redirects` for every legacy URL; **automated redirect tests for every old `page/{id}` and `news_in/{id}` URL**, plus root-path behavior (§16 / DESIGN.md: `/` → 308 to `/ka`).
5. **Backfill RU (+ EN gaps)** — via jobs; `review_status='machine'`; institutional pages human-reviewed pre-launch; archive may launch with the "automatic translation" label.
6. **Gap report** — missing images/PDFs, untranslated items, empty SEO fields, broken internal links, oversized images, duplicate slugs. Content owner signs off against manifest + gap report on staging.

## 12. Deployment, CI/CD & operations

### 12.1 Repo & environments
Single SvelteKit project; Drizzle migrations in `/migrations`; Wrangler bindings: `d1`, `r2`, `queues`, `images`; secrets via `wrangler secret`. Separate `preview`/`production` D1 + R2; preview seeded with representative sanitized data.

### 12.2 CI pipeline
Typecheck → unit + XSS/sanitizer + renderer-fixture tests → Playwright smoke (home, news, procurement, search, admin login+2FA+publish) → **Lighthouse CI budget on public routes only** (fail if public JS > 50 KB gz or LCP regresses; admin has its own budget — see §12.4) → per-PR preview deploy → **smoke tests re-run against the deployed preview Worker** (catches runtime/binding issues) → merge → apply prod D1 migrations (expand/contract; forward-compatible migrations land **before** dependent code) → `wrangler deploy`.

### 12.3 Rollback & release
Code-only rollback via Worker versioned deploys (`wrangler rollback`); schema rollback avoided by expand/contract (contract ships only after the release is proven); each release records its minimum-compatible schema. Release checklist: migrations → deploy → targeted purge → sitemap regen → cron/queue health → backup verified.

### 12.4 Performance budgets (split)
- **Public visitor routes**: ≤ 50 KB gz JS, LCP < 1.5 s measured on a realistic profile (throttled 4G from a European/Caucasus vantage, not localhost), CLS ≈ 0.
- **Admin**: own budget — initial admin bundle ≤ 300 KB gz (TipTap + tooling), interactive < 3 s on desktop broadband. Excluded from public Lighthouse gates; covered by smoke tests.

### 12.5 Observability (named)
- **Sink**: Workers Logs for live/structured logging + **Logpush to a private R2 bucket** for durable retention (90 d); optional Sentry for exception grouping if wanted.
- **Structure**: request id, route family, cache status (hit/miss/stale-snapshot/503), D1 query count, job id, entity id, actor id where relevant. **PII redacted by default** (no emails/message bodies/tokens in durable logs; IP only as salted hash).
- **Alert thresholds** (Cloudflare notifications / CI checks): D1 failure rate, stale-snapshot served, 5xx rate, admin login-failure spike, queue backlog/dead-letters, translation spend cap, image transformation spike, legacy-404 spike post-cutover.

### 12.6 Backups
1. **D1 Time Travel** (30-day PITR) is the first recovery mechanism.
2. Nightly **GitHub Actions** job (scoped API token) runs `wrangler d1 export` → private R2 bucket, 30-day retention.
3. Weekly copy of latest dump + R2 media manifest to **storage outside the Cloudflare account**.
4. **Restore drill** before launch and after schema-heavy releases; D1 media rows and R2 keys backed up together. Content-level recovery for editor mistakes is handled by `content_revisions` (§3), not backups.

## 13. Privacy & legal compliance

- **Data processors documented**: Cloudflare (hosting/logs/Turnstile), OpenRouter + underlying model providers (editorial translation content only), optional email provider. Contact submissions and any personal data are **never** sent to translation providers.
- **Retention schedule**: contact submissions 12 months (`purge_after`, cron-enforced) · audit log 24 months · durable logs 90 days · sessions purged at expiry · reset tokens hours · content revisions ≥ backup window (indefinite for procurement/legal).
- PII redaction in durable logs by default; IP/UA stored only as salted hashes on submissions.
- **Launch checklist items**: publish a privacy policy page (KA/EN/RU); local legal review of (a) applicable Georgian and, where relevant, EU privacy requirements, (b) the procurement/legal machine-translation disclaimer, (c) the "Georgian version is controlling" statement.

## 14. Cost model & guardrails

| Item | Low | Expected | High-ish | Guardrail |
|---|---|---|---|---|
| Workers Paid (D1/R2/Queues base) | $5/mo | $5/mo | $5–10/mo | CPU limits; edge cache absorbs spikes |
| Image transformations | $0 | ~$0–5/mo | bounded | Preset allowlist (variants = presets × images); counter + alert |
| R2 storage/egress | ~$0 | <$1/mo | few $/mo | Upload caps; free egress |
| Logpush/observability | $0 | ~$0–5/mo | ~$10/mo | 90-d retention cap |
| OpenRouter ongoing | pennies | <$5/mo | capped | Monthly cap in job runner + alert |
| OpenRouter backfill (one-off) | — | $3–10 | $20 | Chunked jobs; cheaper model for archive if quality passes |
| Email (optional) | $0 | $0 | ~$10/mo | Free tier first |

## 15. Implementation sequence

**Phase 0 — technical spike (hard gate, throwaway code).** Must prove the difficult production behaviors:
- cache purge-by-tag **plus stale-snapshot fallback** (forced D1 failure after cache expiry);
- **Images binding over R2 bytes** with explicit Cache API storage, per-preset pixel smoke tests, input-size limit check, local-dev passthrough;
- secure upload path: quarantine → magic-byte validation → `active`, media response headers (nosniff, PDF sandbox CSP, attachment fallback);
- login with PBKDF2 (benchmarked), session cookie, CSRF, server-side Turnstile, **TOTP enrollment + verify**;
- ProseMirror JSON → sanitized render under Workers (bundle size + XSS + legacy-schema fixtures);
- one Drizzle migration run against **remote preview D1**, including the FK-alter fixture (`PRAGMA defer_foreign_keys`);
- FTS5 update lifecycle fixture (save → search → unpublish → gone) with KA/EN/RU content;
- OpenRouter structured-output call with a **long-content chunked fixture** (verifies live model id);
- Queues retry + dead-letter behavior on a poison item;
- video Range/206 proxying from R2.

*Exit criteria: all pass in `wrangler dev` and on a preview deploy; no Node-only dependency surprises; budgets hold.*

**Phase 1 — schema + migration harness**: final schema (audit, revisions, versioning, i18n metadata); crawler + snapshot store; parser fixtures; manifest + redirect generation; representative content loaded.
**Phase 2 — public site**: IA, listings/details, search, media delivery, sitemap/robots/SEO, accessibility baseline, cache policy, observability.
**Phase 3 — admin MVP**: login/session/2FA/security first; then News, Pages, Procurement (with status history + amendments), Documents, Media; preview/publish, revisions/restore, audit log, purge-on-publish. Lower-risk sections follow.
**Phase 4 — translation & backfill**: reviewed-workflow translation, then archive backfill via jobs once the review path is proven on institutional/procurement content.
**Phase 5 — cutover**: old-site content freeze → final crawl delta → redirects + smoke tests (incl. root-path) → backup/restore verification → route switch → monitor 404s, cache misses/stale serves, submissions, login failures, transformation counts. Old host read-only for 1 month.

## 16. Go/no-go checklist before full build

Carried from v1:
- [ ] Route-level cache policy (§2.1) approved
- [ ] Image preset list approved
- [ ] OpenRouter model id + fallback verified and pinned
- [ ] Translation governance approved
- [ ] Schema frozen (audit/version/revisions/i18n metadata)
- [ ] Migration manifest format defined
- [ ] Cost guardrails + monitoring counters defined

Added by v2:
- [ ] Stale-snapshot fallback proven after cache expiry + D1 failure (Phase 0)
- [ ] Images-binding mechanism proven with private R2 objects (Phase 0)
- [ ] Upload validation/quarantine/serving policy approved (incl. PDF inline-with-sandbox decision and the AV-scan decision)
- [ ] 2FA required for **all publish-capable users**; `draft_editor` role confirmed
- [ ] TOTP secret encryption + recovery flow designed
- [ ] **Procurement governance approved by the content owner**: status vocabulary, amendment workflow, and whether auto-close at deadline is legally acceptable (default: computed badge only)
- [ ] Content revision/restore model in place
- [ ] `job_items` + dead-letter behavior implemented for queued work
- [ ] D1/Drizzle FK migration behavior tested on preview D1
- [ ] Video Range behavior tested
- [ ] Durable logging sink + alert thresholds configured
- [ ] Privacy/retention/legal-disclaimer tasks on the launch checklist
- [ ] Public/admin performance budgets separated in CI
- [ ] Root-URL behavior (`/` → 308 `/ka`, `x-default` → `/ka`) in redirect + smoke tests
