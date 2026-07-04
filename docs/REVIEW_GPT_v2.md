# engurhesi.ge Rebuild Plan - Critical Review (GPT v2)

Review date: 2026-07-04

Scope reviewed:

- `AGENTS.md` Revision 2
- `DESIGN.md` updated version
- `AUDIT.md`
- `task.md`
- `REVIEW_GPT_v1.md`
- Current public documentation for SvelteKit/Cloudflare, Workers Cache API, D1, R2, Queues, Cloudflare Images/Image Transformations, Turnstile, SQLite FTS5, and OpenRouter structured outputs.

## Executive Verdict

Revision 2 is substantially stronger than the original plan. It incorporates the important v1 corrections: per-edge cache reality, image variant allowlisting, ProseMirror JSON as canonical rich text, text-segment translation instead of raw HTML translation, stronger auth, migration manifests, real backup wording, job queues, and cost guardrails.

The plan is now credible enough to enter a Phase-0 technical spike. It is not credible enough to skip that spike. The remaining risks are mostly implementation-specific: stale cache behavior, the exact R2-to-image-transformation mechanism, upload/file safety, publish-capable account security, procurement governance, content version recovery, D1/Drizzle migration behavior, video streaming/range handling, and privacy/logging.

Recommendation: keep the architecture and proceed with Phase 0, but update the plan with the v2 findings below before starting the full build.

## What Changed Since v1

Fixed or materially improved:

- Cache scope is now described as per-edge, not global.
- Public route cache policy exists.
- Arbitrary image widths were replaced with named presets.
- Rich text canonical storage moved from HTML to ProseMirror JSON.
- Translation now works on text segments/placeholders, not raw HTML.
- Admin auth now includes CSRF, lockout, rate limiting, session expiry, audit logging, and admin-role TOTP.
- Backup wording now acknowledges Worker cron cannot run Wrangler.
- Migration is correctly treated as the main delivery risk.
- Cost estimate was expanded into a guarded table.
- Search is scoped honestly as basic multilingual FTS.

Remaining issue profile:

- Fewer conceptual mistakes.
- More execution traps.
- The project now needs specific technical decisions, not a new architecture.

## Severity Legend

- Blocker: decide or prove before full implementation.
- High: fix in the plan before implementation beyond Phase 0.
- Medium: add acceptance criteria/tests before the affected feature ships.
- Low: useful refinement.

## Key Findings

### 1. Stale-on-D1-failure is still not implementable as written

Severity: High

The plan says public pages use a 24 h cache TTL and that if D1 rendering fails, the Worker serves a stale cached copy if one exists at that edge. The problem is that Workers Cache API does not support `stale-while-revalidate` or `stale-if-error`, and `cache.match()` returns `undefined` for expired/missing entries. With a normal 24 h TTL, the stale object may not be available exactly when it is needed.

Recommended change:

- Choose one explicit stale strategy in Phase 0:
  - Long TTL + purge-on-publish: cache HTML for a long period, rely on tag purges for freshness, and treat TTL mainly as a safety cap.
  - Dual-entry cache: store `fresh` and `stale` variants with application-managed metadata, so render failures can serve an intentionally retained stale copy.
  - Static snapshot fallback: write last-published HTML snapshots to R2/KV and serve those when D1/rendering fails.
- Update the route cache table to distinguish freshness TTL from fallback-retention TTL.
- Add a test that forces D1 failure after cache expiry and proves the intended fallback works.

This is the most important remaining cache issue. The cache-tag approach itself is valid, but stale behavior must be designed rather than assumed.

### 2. The R2 image transformation path needs an exact mechanism

Severity: Blocker for media implementation

The plan says "Cloudflare Image Resizing from R2 originals" and `GET /media/{key}/{preset}`. That is directionally right, but Cloudflare has more than one image path:

- `fetch(url, { cf: { image } })` transforms an image fetched by URL and requires loop prevention/original-image routing.
- The Images binding can transform raw bytes from R2, but transformed responses are not automatically cached and input size limits apply.

Recommended change:

- Pick one implementation for Phase 0:
  - Public/private original URL + `cf.image` fetch, with separate `/originals/*` and `/media/*` routes to prevent loops.
  - Images binding from R2 stream, with explicit Cache API storage for transformed responses.
- Document the implications:
  - cache key,
  - tag purge,
  - max input size,
  - billing unit,
  - local dev behavior,
  - failure response for unsupported formats.
- Keep the 15 MB image upload cap only if the chosen image path can process it reliably.
- Add a pixel-level smoke test for every preset: `thumb`, `card`, `content`, `hero`, and `original`.

The preset allowlist solved the cost hole; this finding is about proving the delivery mechanism works with private R2 objects.

### 3. Upload and file-serving security remains under-specified

Severity: High

The plan blocks SVG-as-image and restricts rich text links, which is good. It still needs a fuller upload safety policy. The admin will accept images, PDFs, and videos and then serve them from the first-party domain. That creates XSS, content-sniffing, malware, and accidental-publication risk.

Recommended change:

- Add a quarantine state: direct R2 upload lands as `pending`; the server validates before media becomes `active`.
- Validate file type by magic bytes, not only browser-provided MIME or extension.
- Set `X-Content-Type-Options: nosniff` on media responses.
- Serve unknown/binary documents with `Content-Disposition: attachment`.
- Decide whether PDFs open inline or download; if inline, set a tight CSP and avoid serving user-uploaded HTML/SVG/XML as renderable content.
- Add upload size limits per type and enforce them both before signing and after upload.
- Record uploader, checksum, detected MIME, and validation result in `audit_log`.
- Consider an AV/malware scan step for PDFs if procurement/legal documents are uploaded by non-technical staff.

R2 is just object storage. The safety boundary has to be implemented in the app.

### 4. Publish-capable editors should also require 2FA

Severity: High

Revision 2 makes TOTP mandatory for admin-role users at launch but allows editors to be phased in. That leaves a gap: editors can publish public content, upload files, and manage procurement/documents. A compromised editor account can still deface the site or alter legally meaningful notices.

Recommended change:

- Require TOTP or WebAuthn for every account that can publish, upload public files, edit procurement, or edit legal/report pages.
- If a lower-friction role is needed, create a true `draft_editor` role that cannot publish or modify procurement/legal content.
- Encrypt TOTP secrets at rest with a key stored outside D1, for example a Wrangler secret.
- Add recovery codes, TOTP reset flow, and audit events for 2FA enrollment/reset.
- Consider WebAuthn/passkeys for admins if implementation cost is acceptable.

The current "admin-only TOTP" line is not aligned with the risk surface of editor accounts.

### 5. Procurement needs stronger governance than open/closed/awarded

Severity: High

The plan correctly promotes procurement to a first-class module, but the workflow still looks too simple for public procurement content. Deadlines, amendments, cancellations, award notices, and document revisions often matter more than a single status value.

Recommended change:

- Expand status vocabulary or model it as status history:
  - draft,
  - published/open,
  - deadline_passed,
  - closed,
  - amended,
  - canceled,
  - awarded,
  - archived.
- Treat "deadline has passed" as a computed/public badge unless the organization confirms that automatic mutation from `open` to `closed` is legally correct.
- Add amendment support: related notice, change summary, previous deadline, new deadline, attached amendment document.
- Preserve all document revisions; never overwrite a procurement PDF in place.
- Require an explicit audit reason for deadline/status changes.
- Consider a stricter role permission for procurement publishing.

The existing auto-close idea is useful operationally, but it should not become an accidental legal statement.

### 6. Content version recovery is missing

Severity: High

The plan has `audit_log`, optimistic locking, and publish/unpublish logging. It does not clearly provide content revision snapshots. Audit logs tell you who did something; they do not necessarily let you restore the previous article/page/procurement body after a bad edit.

Recommended change:

- Add a `content_revisions` table or per-entity revision tables.
- Store a snapshot on save and on publish:
  - entity type/id,
  - locale,
  - version,
  - title,
  - ProseMirror JSON,
  - derived HTML/text hash,
  - status,
  - actor,
  - timestamp.
- Provide admin UI for "view previous version" and "restore as draft".
- Retain revisions at least through the backup retention window; longer for procurement/legal pages.

For a small CMS, this is often more useful than a complex approval workflow.

### 7. Rich text is architecturally fixed, but schema evolution is not planned

Severity: Medium

Moving to ProseMirror JSON is the right correction. The next risk is long-term schema evolution: TipTap node/mark schemas change, custom media nodes evolve, and old JSON documents must still render.

Recommended change:

- Add `content_schema_version` to every rich text i18n row or to the JSON document root.
- Keep renderer fixture tests for every supported node/mark, including old schema versions.
- Define what happens when a node becomes unsupported: migration, read-only warning, or render fallback.
- In Phase 0, test the exact server-side renderer package under Workers, including bundle size.

This does not block the stack choice; it prevents content becoming unreadable after editor changes.

### 8. Translation still needs chunking and review-state precision

Severity: Medium

The safer text-segment pipeline is a major improvement. Two details remain:

- "One entity = one API call" can fail for long pages, tables, or future content growth.
- A human edit is not the same as legal/editorial review.

Recommended change:

- Keep the "EN + RU together" rule, but allow chunking by segment groups for long entities.
- Store per-locale `review_status`: `missing`, `machine`, `human_edited`, `reviewed`, rather than relying only on `machine_translated` and `reviewed_at`.
- After Georgian source edits, compare `source_hash` and mark target locales stale if the source changed materially.
- Add a glossary/terminology table or file versioned with the prompt.
- Add fixture tests for long pages and tables, not only short articles.

This keeps the cost-efficient translation approach without making it brittle.

### 9. Jobs should use job items, not one large JSON result blob

Severity: Medium

The `jobs` table says "per-item results" inside the job row. That is acceptable for a tiny prototype but awkward for resumability, retries, and failure inspection.

Recommended change:

- Add `job_items`:
  - `job_id`,
  - item key/entity,
  - status,
  - attempts,
  - last_error,
  - result_json,
  - started_at,
  - finished_at.
- Make every queued item idempotent with a deterministic idempotency key.
- Add dead-letter handling for poison messages.
- Keep the parent `jobs.progress` as a derived summary.

The plan already says jobs are chunked and resumable; the schema should reflect that.

### 10. D1/Drizzle migration details need one more guardrail

Severity: Medium

D1 supports foreign keys and migrations, but Cloudflare documents specific foreign-key migration behavior. When migrations temporarily violate constraints, D1 expects `PRAGMA defer_foreign_keys = true`, not the common SQLite pattern of turning foreign keys off.

Recommended change:

- Add a migration acceptance criterion: generated Drizzle migrations are inspected/tested against remote preview D1 before production.
- Include a fixture migration that alters a foreign-keyed table.
- Make seed/import scripts idempotent.
- Keep all schema changes forward-compatible under the expand/contract rule already in the plan.

This is a practical build-time trap, not an architecture objection.

### 11. Video delivery needs Range-request behavior

Severity: Medium

The design plan says self-hosted videos stream from R2. That is fine for a small media archive, but video playback depends on Range requests. A Worker media proxy must pass through `Range`, return `206 Partial Content`, and avoid trying to `cache.put()` partial responses.

Recommended change:

- Define video handling separately from image/document handling.
- Support and test `Range` requests from R2.
- Do not cache `206` responses with the Cache API.
- Consider a public R2 custom domain for large video files, or Cloudflare Stream if future video volume grows.
- Keep the facade pattern so video requests happen only after user interaction.

The current plan is okay for thumbnails, but video bytes need a specific route contract.

### 12. Search indexing lifecycle is not specified

Severity: Medium

The search choice is acceptable, and v2 is honest about Georgian/Russian limitations. The remaining gap is how `search_index` stays correct.

Recommended change:

- Decide whether indexing is done through explicit application writes or SQLite triggers.
- Update the FTS row in the same logical transaction as content save/publish.
- Remove or mark search rows on unpublish/delete.
- Add tests for stale search results after edit, unpublish, and locale fallback.
- Track FTS table size after import and after the RU backfill.

At this content scale, correctness matters more than search sophistication.

### 13. Privacy and legal compliance need their own section

Severity: Medium

The plan now has retention for contact submissions and excludes contact submissions from OpenRouter. Good. It still needs a compact privacy/compliance section because the site handles contact-form PII, admin user data, IP/user-agent hashes, logs, Turnstile validation, and third-party translation routing.

Recommended change:

- Add a privacy policy task to the launch checklist.
- Document data processors: Cloudflare, OpenRouter/providers, optional email provider.
- Define retention for:
  - contact submissions,
  - audit logs,
  - access/error logs,
  - admin sessions,
  - password reset records.
- Redact PII from durable logs by default.
- Confirm whether Georgian or EU privacy requirements apply; get local legal review for procurement/legal disclaimers.

This is not a reason to change the stack. It is launch hygiene for an official public site.

### 14. Observability is too vague

Severity: Medium

The plan says "Workers Analytics + error logging" and lists counters. It should name the durable log destination and alerting path. Worker console/tail output is not an operational logging system.

Recommended change:

- Pick a durable logging sink: Cloudflare Logpush, Workers Logs, Sentry, Axiom, or another chosen provider.
- Use structured logs with request id, route family, cache status, D1 query count, job id, entity id, and actor id where appropriate.
- Redact personal data and secrets.
- Define alert thresholds:
  - D1 failures,
  - stale fallback served,
  - 5xx rate,
  - admin login failures,
  - queue backlog,
  - translation spend cap,
  - image transformation spike,
  - legacy 404 spike after cutover.

Without durable logs, the migration/cutover safety net is weaker than the plan implies.

### 15. Public performance budget should explicitly exclude admin

Severity: Low

The JS budget of `<= 50 KB gz` is appropriate for the public site but unrealistic if applied to the admin bundle with TipTap and media tooling.

Recommended change:

- State that the 50 KB JS budget applies to public visitor routes.
- Give admin its own budget and performance target.
- Run Lighthouse/Playwright budgets on public pages separately from admin smoke tests.
- Test LCP from a realistic geography/network profile, not only a local machine.

This avoids false CI failures and keeps the performance promise focused where it matters.

### 16. Locale/root URL behavior should be specified

Severity: Low

The design IA shows `/` as Home, while the URL rule says all locales use `/ka`, `/en`, `/ru`. The current site defaults to `/ka`. The new behavior should be explicit.

Recommended change:

- Decide whether `/` redirects to `/ka`, negotiates language, or serves Georgian directly.
- Keep `x-default` hreflang consistent with that choice.
- Include root-path behavior in redirect and smoke tests.

This is small, but it affects SEO, analytics, and launch testing.

## Updated Go/No-Go Additions

Add these to the existing go/no-go checklist:

- [ ] Stale fallback strategy proven after cache expiry and D1 failure.
- [ ] Exact R2 image transformation mechanism chosen and tested.
- [ ] Upload validation/quarantine/content-serving policy approved.
- [ ] 2FA required for all publish-capable users, or roles split so non-2FA users cannot publish.
- [ ] TOTP secret encryption and recovery flow designed.
- [ ] Procurement amendment/status-history workflow approved by the content owner.
- [ ] Content revision/restore model added.
- [ ] `job_items`/dead-letter behavior added for queued work.
- [ ] D1/Drizzle foreign-key migration behavior tested on preview D1.
- [ ] Video Range request behavior tested.
- [ ] Durable logging sink and alert thresholds chosen.
- [ ] Privacy/retention/legal-disclaimer tasks added to launch checklist.
- [ ] Public/admin performance budgets separated.

## Revised Recommendation

Proceed with the stack and the implementation sequence in `AGENTS.md`, but make Phase 0 a hard gate. The Phase-0 spike should not only prove that SvelteKit runs on Workers; it should prove the difficult production behaviors:

- cache purge plus stale fallback,
- R2 image transforms through the exact chosen API,
- secure uploads and media response headers,
- login/2FA/session/CSRF under Workers,
- ProseMirror render/sanitize under Workers,
- D1/Drizzle migration against preview D1,
- FTS update lifecycle,
- OpenRouter structured output with a long-content fixture,
- queue retry/dead-letter behavior,
- video Range request proxying.

If those pass, the plan is strong enough to build. If any fail, the likely changes are local substitutions, not a wholesale architecture change.

## Source Notes Checked

- SvelteKit Cloudflare adapter: https://svelte.dev/docs/kit/adapter-cloudflare
- Cloudflare Workers Cache API: https://developers.cloudflare.com/workers/runtime-apis/cache/
- Cloudflare cache purge and purge by tag: https://developers.cloudflare.com/cache/how-to/purge-cache/ and https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-tags/
- Cloudflare D1 limits and Time Travel: https://developers.cloudflare.com/d1/platform/limits/ and https://developers.cloudflare.com/d1/reference/time-travel/
- Cloudflare D1 migrations/foreign keys: https://developers.cloudflare.com/d1/reference/migrations/ and https://developers.cloudflare.com/d1/sql-api/foreign-keys/
- Cloudflare Queues pricing/behavior: https://developers.cloudflare.com/queues/platform/pricing/
- Cloudflare R2 Workers API: https://developers.cloudflare.com/r2/api/workers/workers-api-usage/
- Cloudflare Images transform via Workers: https://developers.cloudflare.com/images/optimization/transformations/transform-via-workers/
- Cloudflare Images binding: https://developers.cloudflare.com/images/optimization/binding/
- Cloudflare Images pricing: https://developers.cloudflare.com/images/pricing/
- Cloudflare Turnstile server-side validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- SQLite FTS5 documentation: https://www.sqlite.org/fts5.html
- OpenRouter structured outputs and provider routing: https://openrouter.ai/docs/guides/features/structured-outputs and https://openrouter.ai/docs/guides/routing/provider-selection

