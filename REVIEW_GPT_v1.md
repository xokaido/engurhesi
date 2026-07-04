# engurhesi.ge Rebuild Plan - Critical Review (GPT v1)

Review date: 2026-07-04

Scope reviewed:

- `task.md`
- `AUDIT.md`
- `DESIGN.md`
- `AGENTS.md`
- Current public documentation for the main platform assumptions: SvelteKit on Cloudflare, Workers Cache API, Cache-Tag purge, D1, R2, Turnstile, Cloudflare Images, SQLite FTS5, and OpenRouter structured outputs.

## Executive Verdict

The plan is directionally strong. SvelteKit on Cloudflare Workers with D1 and R2 is a credible fit for this site: the content set is small, public reads dominate, the admin workload is light, and the performance goal favors SSR plus edge caching over a traditional VPS/CMS stack.

The plan is not yet implementation-ready. It overstates some Cloudflare behavior, under-specifies security and editorial governance, and treats the riskiest parts - caching, image transformations, custom auth, translation, rich text sanitization, backups, and migration validation - as solved details. Those are exactly the places that can turn a small rebuild into a fragile production system.

Recommendation: proceed with the chosen stack, but revise the plan before building. Keep the architecture, tighten the operational/security model, add missing data-model fields, and run a small technical spike before committing to the full CMS.

## Severity Legend

- Blocker: decide or prove before implementation starts.
- High: fix in the architecture/spec before the first serious build sprint.
- Medium: implementation risk that needs explicit acceptance criteria.
- Low: refinement or documentation improvement.

## Key Findings

### 1. The edge caching model is oversold

Severity: High

The plan says public pages are "rendered once, cached at edge" and that most visitors never touch D1. That is directionally true only after a page has been requested in the relevant edge location. Cloudflare's Workers Cache API is local to the data center that stores the entry; it is not a globally replicated HTML cache. The docs also note that `stale-while-revalidate` and `stale-if-error` are not supported by `cache.put` / `cache.match`.

Cache tags are real and useful, but the implementation must be explicit:

- Public HTML responses must never carry `Set-Cookie` into `cache.put`.
- Every cached page needs deterministic cache keys by locale, route, query parameters, auth state, preview state, and device-neutral variants.
- Search pages, admin pages, previews, form responses, and anything personalized must bypass the public HTML cache.
- Purge-by-tag requires emitting `Cache-Tag` headers or putting tagged responses into cache, then calling Cloudflare's purge API with a scoped token.
- The plan should define what happens on D1 failure: serve stale cached HTML where possible, return a controlled 503 where not possible, and log the miss/failure path.

Recommended change: keep edge caching, but specify a cache policy table per route family. Do not describe it as "render once globally." Treat it as "render on first request per edge cache, then purge by affected tags."

### 2. The media route invites uncontrolled image transformation cost

Severity: Blocker

`GET /media/{key}?w=...` is too open-ended. Cloudflare Images bills remote image transformations by unique source plus transformation parameters. If arbitrary widths are accepted, a bot or broken client can generate thousands of unique variants. That creates cost risk and, on the free Images tier, can cause new variants to fail after the monthly included transformation limit is exhausted.

Recommended change:

- Replace arbitrary `w` with a fixed preset or allowlist, for example `thumb`, `card`, `content`, `hero`, `original`.
- If width parameters remain, clamp and round them to an approved set: `320, 480, 640, 960, 1280, 1600, 1920`.
- Normalize all transformation options before caching and billing: width, fit, quality, format, DPR.
- Reject unknown transformation parameters instead of passing them through.
- Store image dimensions, focal point, dominant color/blur placeholder, and original file hash at upload time.
- Add tests proving that `?w=641`, `?w=650`, and `?w=700` resolve to the same approved variant if rounding is used.

This change is small but important. It protects the cost model and gives designers predictable image behavior.

### 3. D1 is a good fit, but the plan hides its throughput shape

Severity: Medium

D1 is suitable for the projected content volume. The current plan's content scale is tiny relative to D1's documented limits. The real constraint is not storage; it is that each D1 database processes queries serially, so slow queries directly reduce throughput. Edge caching makes that acceptable for public reads, but admin writes, search, publication, cron jobs, and migration scripts still need careful query design.

Recommended change:

- Add explicit indexes for all listing and lookup patterns: locale, slug, status, category, published date, deadline, sort.
- Add `updated_at`, `created_at`, `created_by`, `updated_by`, and optimistic-lock `version` fields to editable entities.
- Keep large media and derived image data out of D1 rows.
- Store stripped plain text for search indexing rather than relying on HTML bodies.
- Benchmark the top routes against local D1 and remote preview D1 before declaring the performance budget met.
- Decide whether D1 read replication is unnecessary or worth enabling later. It should not be assumed.

### 4. FTS5 is supported, but multilingual search quality is not solved

Severity: Medium

Cloudflare D1 supports SQLite FTS5, so the search choice is feasible. The plan still needs a search-quality design for Georgian, English, and Russian. SQLite's built-in `porter` tokenizer is English-focused, and the default tokenizer will not provide Georgian or Russian stemming. That may be acceptable for this site, but it must be an explicit product decision.

Recommended change:

- Use FTS5, but test Georgian and Cyrillic queries before finalizing.
- Consider `unicode61` with prefix indexes for normal word search and/or a trigram index for substring-like matching.
- Normalize punctuation, quotes, HTML entities, Georgian casing behavior, and Cyrillic text consistently.
- Add fixture tests with real titles from the crawl: procurement notices, project names, Enguri HPP terms, person names, and common Georgian word endings.
- Define search ranking rules per entity type. Procurement and pages may need to outrank old news.

### 5. The translation plan should not translate raw HTML

Severity: High

The plan asks Gemini/OpenRouter to preserve HTML tags exactly. That is brittle. Even strong structured-output models can alter tag order, attributes, links, whitespace, or embedded entities. For legal/procurement content, a subtle broken link or malformed table is a real issue.

Recommended change:

- Store rich text as ProseMirror JSON or another structured document format, not as the primary editable HTML source.
- Translate extracted text nodes, not raw HTML. Preserve marks, links, tables, media references, and embedded documents in application code.
- If HTML must be sent, replace tags/links/media with placeholders, validate round-trip structure, and reject the result if placeholders do not match.
- Store translation metadata: provider, model id, source hash, prompt version, translated_at, machine_translated, reviewed_at, reviewed_by.
- Validate OpenRouter structured outputs with a strict JSON Schema and use provider preferences that require structured-output support.
- Do not publish machine-translated legal, procurement, or policy content as reviewed content. Georgian should remain the controlling source.

Current model detail: the plan names `google/gemini-3.1-pro`, but the OpenRouter model page checked during this review exposed `google/gemini-3.1-pro-preview`. The implementation should not hard-code the non-preview id until the exact available model id is verified at build time.

### 6. The auth plan is solid in outline but not hardened enough for launch

Severity: High

Owning auth is acceptable for a small admin panel, but this is an official corporate/state-linked public site with procurement content. "Optional TOTP later" is too weak for launch. The plan also omits several necessary tables and behaviors.

Recommended change:

- Make TOTP or WebAuthn mandatory for admin users at launch; allow editors to be phased in if necessary.
- Add tables for password reset tokens, email-change tokens if needed, and admin audit logs.
- Add `sessions.last_seen_at`, `sessions.absolute_expires_at`, and a throttled idle-extension policy. Updating session expiry on every request creates avoidable D1 writes.
- Define CSRF token generation, storage, and verification. SameSite cookies help but are not a full CSRF plan for admin form actions.
- Benchmark PBKDF2 iteration count in Workers. Pick a cost that is meaningful but does not create denial-of-service risk under login attempts.
- Log security events: login success/failure, lockout, password reset, user creation, role change, publish/unpublish/delete.
- Use Turnstile server-side validation on login/contact forms. The client widget alone is not protection.

### 7. Rich text sanitization is under-specified for Workers

Severity: High

The plan says TipTap outputs sanitized HTML server-side. That hides a major implementation choice. Many familiar sanitizers depend on Node or DOM APIs that may be heavy or awkward in Workers. If sanitization is wrong, the admin becomes an XSS source for the public site.

Recommended change:

- Prefer storing ProseMirror JSON and rendering through a strict server-side renderer.
- If storing HTML, sanitize on save with an edge-compatible allowlist parser and sanitize again or validate on render.
- Allow only the required schema: headings, paragraphs, lists, links, images by media id, tables, and limited inline marks.
- Block raw iframes, scripts, inline event handlers, `javascript:` URLs, arbitrary styles, SVG uploads as images unless sanitized separately, and unknown attributes.
- Add XSS regression tests before any admin content can be published.

### 8. The data model has important gaps and inconsistencies

Severity: High

The multilingual pattern is good, but the schema block is not complete enough to guide implementation. It also contradicts the narrative in a few places.

Specific issues:

- The text says every `*_i18n` row has `machine_translated`, but the schema block omits it.
- `media` has `alt_ka` and `alt_en`, but no `alt_ru`.
- `media` needs `original_filename`, `checksum`, `created_by`, `updated_at`, `caption_*`, optional credit/source, focal point, and status.
- Article galleries are mentioned in admin UX, but no `article_media` or gallery join table exists.
- Documents may need per-locale file variants, not only per-locale titles.
- Procurement documents need titles, language, file type, and maybe version/revision metadata.
- Deadline handling needs timezone and status history. "Auto-flips open to closed" should be auditable.
- `submissions` needs retention fields and possibly IP/user-agent hashing for abuse handling.
- User management needs reset-token and audit-log tables.
- Redirects need uniqueness, status code, source locale, and conflict handling.
- Editable entities need `created_at`, `updated_at`, `created_by`, `updated_by`, and `version`.

Recommended change: update the schema before implementation and add constraints. In a small CMS, boring metadata is what makes recovery and editorial accountability possible.

### 9. Migration is the biggest delivery risk

Severity: High

The plan correctly identifies the parser as the custom-risk piece, but it understates the amount of validation required. Procurement notices, legal pages, reports, PDFs, and old URLs are not just content; some are part of a public accountability trail.

Recommended change:

- Build a migration manifest with every crawled URL, status code, detected content type, old numeric id, target entity, target id, media references, and redirect target.
- Keep raw HTML snapshots and downloaded media checksums.
- Write parser fixtures from real old pages, especially auctions/tenders, reports, project pages, albums, and English pages with Georgian fallback content.
- Do not rely only on inferred procurement status. Add `migration_confidence` and manually review all active/recent procurement items.
- Generate redirect tests for every old `page/{id}` and `news_in/{id}` URL.
- Produce a post-migration gap report: missing images, missing PDFs, untranslated items, empty SEO fields, broken internal links, oversized images, duplicate slugs.
- Keep an offline copy of the old site crawl, not just the live old host, before cutover.

### 10. Backup and cron wording needs correction

Severity: High

The plan says "nightly cron exports D1 (`wrangler d1 export`) to a private R2 bucket." A Worker scheduled cron cannot run the Wrangler CLI. If this means a GitHub Actions schedule or another external job running Wrangler, the plan should say that. If it means a Cloudflare-native job, use the documented D1 Time Travel / Workflows approach or the D1 API where appropriate.

Recommended change:

- Treat D1 Time Travel as the first recovery mechanism.
- Add an external export job, such as GitHub Actions with Wrangler and a scoped API token, or a Cloudflare Workflow designed for exporting to R2.
- Store at least one backup copy outside the same Cloudflare account or document why account-level lockout/loss is accepted.
- Run a restore drill before launch and after major schema changes.
- Back up R2 metadata and D1 media rows together so file references remain recoverable.

### 11. CI/CD ordering and rollback are not detailed enough

Severity: Medium

The plan says merge to `main` applies migrations and deploys. The ordering matters. If new code deploys before the schema exists, the site can fail. If schema changes are not backward compatible, rollback becomes difficult.

Recommended change:

- Use expand/contract migrations: add nullable/new fields first, deploy compatible code, backfill, then remove old fields later.
- Apply forward-compatible D1 migrations before deploying code that requires them.
- Keep production and preview D1/R2 separate, but seed preview with representative sanitized data.
- Add smoke tests against the deployed preview Worker, not only local tests.
- Define rollback behavior for code-only rollback versus schema rollback.
- Add a release checklist for cache purge, sitemap regeneration, cron health, and backup success.

### 12. The cost estimate is plausible but too narrow

Severity: Medium

The "$5/mo" estimate is possible for low traffic, but it currently reads like a total expected bill. It omits or compresses several variable items: Images transformations, Workers request/CPU overages, Logpush or advanced analytics, email forwarding/provider costs, OpenRouter usage, and possible paid Cloudflare features such as Images Paid if transformation volume exceeds the free tier.

Recommended change:

- Present a cost table with low/expected/high ranges.
- Add guardrails: CPU limit, transformation width allowlist, upload size limits, translation budget cap, and alert thresholds.
- Track monthly counts for page renders, D1 queries, R2 reads/writes, image transformations, Turnstile validations, and translation tokens.
- Consider using a cheaper translation model for bulk news/archive backfill, reserving Gemini Pro-class models for high-value institutional/legal pages if quality testing supports that split.

### 13. OpenRouter is convenient, but governance needs explicit approval

Severity: Medium

Using OpenRouter is technically convenient, but draft content will be sent to an external model router and provider. That may be fine, especially if most source content is already public, but the decision should be explicit for procurement notices, unpublished announcements, contact-related text, and institutional pages.

Recommended change:

- Document what content may be sent to OpenRouter and what may not.
- Do not send contact submissions or private admin notes to translation.
- Keep the API key server-side and scope environment access.
- Save model/provider metadata with translations for auditability.
- Define a fallback path when OpenRouter/model/provider is unavailable.

### 14. One Worker is acceptable, but background work should not be one request

Severity: Medium

One Worker and one repo is a good operational simplification. But long-running jobs such as archive translation, media backfill, sitemap rebuild, and bulk cache purge should not be implemented as a single admin HTTP request.

Recommended change:

- Use Queues, Workflows, or chunked admin jobs for bulk translation/migration/backfill.
- Store job status and per-entity results.
- Make jobs resumable and idempotent.
- Give editors safe feedback: queued, running, succeeded, failed, retry.

### 15. The design direction is strong, with two caveats

Severity: Low

The design plan is the strongest part of the package. It correctly removes the carousel, promotes procurement and stats, improves IA, and keeps public JS low.

Caveats:

- The color direction could become a one-note blue energy-site palette. Define a broader but restrained palette early and test contrast in Georgian, English, and Russian.
- The "full trilingual locale" promise must include real Cyrillic font support, layout testing with longer Russian strings, and honest fallback messaging where content remains Georgian-only.

## Recommended Revised Architecture

Keep:

- SvelteKit with `@sveltejs/adapter-cloudflare`.
- Cloudflare Workers as the application runtime.
- D1 for CMS data.
- R2 for media/files.
- Turnstile for login/contact abuse protection.
- Edge caching with purge on publish.
- Drizzle migrations.
- TipTap or ProseMirror-style editing for admin, if the storage/rendering model is made safe.

Change:

- Replace arbitrary media widths with approved image presets.
- Store rich text structurally, or sanitize through an edge-compatible allowlist pipeline.
- Translate text nodes/structured fields, not raw HTML.
- Make TOTP/WebAuthn a launch requirement for admins.
- Add audit logs, revision/version fields, reset-token tables, and missing i18n metadata.
- Use external scheduled jobs or Cloudflare Workflows for D1 exports; do not imply Worker cron can run Wrangler.
- Add route-level cache policy and route-level no-cache rules.
- Treat FTS5 as "basic multilingual search" until tested with real Georgian/Russian queries.

## Suggested Implementation Sequence

### Phase 0 - Technical spike

Build a throwaway SvelteKit/Workers proof with:

- One D1 schema migration and Drizzle query.
- One public SSR page cached with tags and purged through API.
- One media route with image presets.
- One login form with PBKDF2, session cookie, CSRF, Turnstile validation stub, and admin guard.
- One TipTap/ProseMirror save/render/sanitize path.
- One FTS5 search fixture with KA/EN/RU sample content.
- One OpenRouter structured-output call against a small translation fixture.

Exit criteria: route works in `wrangler dev` and preview deploy; bundle size is acceptable; no Node-only dependency surprises; cache purge works; sanitization tests pass.

### Phase 1 - Schema and migration harness

- Finalize schema with metadata, constraints, and audit tables.
- Build crawler and raw snapshot store.
- Build transformation fixtures and redirect manifest.
- Load a small representative content set.

### Phase 2 - Public site

- Build IA, pages, listings, detail routes, search, media delivery, sitemap, robots, SEO, and accessibility baseline.
- Add cache policy and observability.

### Phase 3 - Admin MVP

- Build login/session/security first.
- Build News, Pages, Procurement, Documents, and Media before lower-risk sections.
- Add preview/publish, audit log, and cache purge.

### Phase 4 - Translation and backfill

- Add translation as a reviewed workflow, not a magic publish action.
- Backfill low-risk archive content after institutional/procurement review path is proven.

### Phase 5 - Cutover

- Freeze old content briefly.
- Run final crawl delta.
- Apply redirects and smoke tests.
- Verify backups and restore path.
- Launch behind Cloudflare route.
- Monitor 404s, cache misses, form submissions, admin login failures, and image transformation counts.

## Go/No-Go Checklist Before Build

- [ ] Route-level cache policy written.
- [ ] Image variant allowlist approved.
- [ ] Exact OpenRouter model id and fallback model chosen.
- [ ] Translation governance approved.
- [ ] Admin 2FA decision made.
- [ ] Rich text storage and sanitization approach proven on Workers.
- [ ] D1 schema updated with audit, versioning, and missing i18n fields.
- [ ] Migration QA manifest format defined.
- [ ] Backup/export mechanism corrected and restore drill planned.
- [ ] Cost guardrails and monitoring counters defined.
- [ ] Legal/procurement source-of-truth and machine-translation disclaimer decided.

## Source Notes Checked

- SvelteKit Cloudflare adapter: https://svelte.dev/docs/kit/adapter-cloudflare
- Cloudflare Workers Cache API: https://developers.cloudflare.com/workers/runtime-apis/cache/
- Cloudflare cache purge by tag: https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-tags/
- Cloudflare D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- Cloudflare D1 SQL statements and FTS5 support: https://developers.cloudflare.com/d1/sql-api/sql-statements/
- Cloudflare D1 import/export: https://developers.cloudflare.com/d1/best-practices/import-export-data/
- Cloudflare D1 Time Travel/backups: https://developers.cloudflare.com/d1/reference/time-travel/
- Cloudflare R2 presigned URLs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- Cloudflare Images overview/transformations/pricing: https://developers.cloudflare.com/images/ and https://developers.cloudflare.com/images/pricing/
- Cloudflare Turnstile server validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- SQLite FTS5 tokenizer documentation: https://www.sqlite.org/fts5.html
- OpenRouter structured outputs: https://openrouter.ai/docs/guides/features/structured-outputs
- OpenRouter Gemini 3.1 Pro Preview model page: https://openrouter.ai/google/gemini-3.1-pro-preview

