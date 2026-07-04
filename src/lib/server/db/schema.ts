import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------------------
// Shared column conventions (AGENTS.md §3)
// ---------------------------------------------------------------------------

/** Audit + optimistic-lock columns present on every editable entity. */
const entityMeta = {
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
	createdBy: text('created_by'),
	updatedBy: text('updated_by'),
	version: integer('version').notNull().default(1)
};

/** Rich-text storage: canonical ProseMirror JSON + derived HTML/text. */
const bodyColumns = {
	bodyJson: text('body_json'),
	bodyHtml: text('body_html'),
	bodyText: text('body_text'),
	contentSchemaVersion: integer('content_schema_version').notNull().default(1)
};

/** Translation metadata carried by every *_i18n row. */
const i18nMeta = {
	reviewStatus: text('review_status', {
		enum: ['missing', 'machine', 'human_edited', 'reviewed']
	})
		.notNull()
		.default('missing'),
	staleSource: integer('stale_source').notNull().default(0),
	translationModel: text('translation_model'),
	translationProvider: text('translation_provider'),
	sourceHash: text('source_hash'),
	promptVersion: text('prompt_version'),
	translatedAt: text('translated_at'),
	reviewedAt: text('reviewed_at'),
	reviewedBy: text('reviewed_by')
};

export const LOCALES = ['ka', 'en', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];
const localeColumn = () => text('locale', { enum: LOCALES }).notNull();

// ---------------------------------------------------------------------------
// Auth & accountability
// ---------------------------------------------------------------------------

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	name: text('name').notNull(),
	role: text('role', { enum: ['admin', 'editor', 'draft_editor'] }).notNull(),
	passwordHash: text('password_hash').notNull(),
	passwordSalt: text('password_salt').notNull(),
	totpSecretEnc: text('totp_secret_enc'),
	totpVerified: integer('totp_verified').notNull().default(0),
	recoveryCodesHashed: text('recovery_codes_hashed'),
	failedLogins: integer('failed_logins').notNull().default(0),
	lockedUntil: text('locked_until'),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	tokenHash: text('token_hash').notNull(),
	csrfToken: text('csrf_token').notNull(),
	createdAt: text('created_at').notNull(),
	lastSeenAt: text('last_seen_at').notNull(),
	idleExpiresAt: text('idle_expires_at').notNull(),
	absoluteExpiresAt: text('absolute_expires_at').notNull(),
	ip: text('ip'),
	userAgent: text('user_agent')
});

export const resetTokens = sqliteTable('reset_tokens', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	tokenHash: text('token_hash').notNull(),
	expiresAt: text('expires_at').notNull(),
	usedAt: text('used_at')
});

export const auditLog = sqliteTable('audit_log', {
	id: text('id').primaryKey(),
	actorId: text('actor_id'),
	action: text('action').notNull(),
	entityType: text('entity_type'),
	entityId: text('entity_id'),
	reason: text('reason'),
	detailJson: text('detail_json'),
	createdAt: text('created_at').notNull()
});

export const contentRevisions = sqliteTable('content_revisions', {
	id: text('id').primaryKey(),
	entityType: text('entity_type').notNull(),
	entityId: text('entity_id').notNull(),
	locale: localeColumn(),
	version: integer('version').notNull(),
	title: text('title').notNull(),
	bodyJson: text('body_json'),
	derivedHash: text('derived_hash'),
	statusAtSave: text('status_at_save'),
	actorId: text('actor_id'),
	createdAt: text('created_at').notNull()
});

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export const media = sqliteTable('media', {
	id: text('id').primaryKey(),
	r2Key: text('r2_key').notNull().unique(),
	kind: text('kind', { enum: ['image', 'document', 'video'] }).notNull(),
	declaredMime: text('declared_mime').notNull(),
	detectedMime: text('detected_mime'),
	size: integer('size').notNull(),
	width: integer('width'),
	height: integer('height'),
	originalFilename: text('original_filename').notNull(),
	checksum: text('checksum').notNull(),
	focalX: real('focal_x'),
	focalY: real('focal_y'),
	placeholderColor: text('placeholder_color'),
	status: text('status', { enum: ['pending', 'active', 'rejected', 'orphaned'] }).notNull(),
	createdBy: text('created_by'),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});

export const mediaI18n = sqliteTable('media_i18n', {
	mediaId: text('media_id')
		.notNull()
		.references(() => media.id),
	locale: localeColumn(),
	alt: text('alt'),
	caption: text('caption'),
	credit: text('credit')
});

// ---------------------------------------------------------------------------
// Content: pages / articles / projects
// ---------------------------------------------------------------------------

export const pages = sqliteTable('pages', {
	id: text('id').primaryKey(),
	slug: text('slug').notNull().unique(),
	section: text('section', { enum: ['about', 'standalone'] })
		.notNull()
		.default('about'),
	sort: integer('sort').notNull().default(0),
	status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
	publishedAt: text('published_at'),
	legacyId: integer('legacy_id'),
	...entityMeta
});

export const pageI18n = sqliteTable('page_i18n', {
	pageId: text('page_id')
		.notNull()
		.references(() => pages.id),
	locale: localeColumn(),
	title: text('title').notNull().default(''),
	seoTitle: text('seo_title'),
	seoDescription: text('seo_description'),
	...bodyColumns,
	...i18nMeta
});

export const articles = sqliteTable('articles', {
	id: text('id').primaryKey(),
	slug: text('slug').notNull().unique(),
	category: text('category', { enum: ['news', 'announcement', 'publication'] }).notNull(),
	coverMediaId: text('cover_media_id'),
	status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
	publishedAt: text('published_at'),
	legacyId: integer('legacy_id'),
	...entityMeta
});

export const articleI18n = sqliteTable('article_i18n', {
	articleId: text('article_id')
		.notNull()
		.references(() => articles.id),
	locale: localeColumn(),
	title: text('title').notNull().default(''),
	excerpt: text('excerpt'),
	seoDescription: text('seo_description'),
	...bodyColumns,
	...i18nMeta
});

export const articleMedia = sqliteTable('article_media', {
	articleId: text('article_id')
		.notNull()
		.references(() => articles.id),
	mediaId: text('media_id')
		.notNull()
		.references(() => media.id),
	sort: integer('sort').notNull().default(0)
});

export const projects = sqliteTable('projects', {
	id: text('id').primaryKey(),
	slug: text('slug').notNull().unique(),
	coverMediaId: text('cover_media_id'),
	sort: integer('sort').notNull().default(0),
	status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
	factsJson: text('facts_json'),
	...entityMeta
});

export const projectI18n = sqliteTable('project_i18n', {
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id),
	locale: localeColumn(),
	title: text('title').notNull().default(''),
	summary: text('summary'),
	...bodyColumns,
	...i18nMeta
});

// ---------------------------------------------------------------------------
// Procurement
// ---------------------------------------------------------------------------

export const PROCUREMENT_STATUSES = [
	'draft',
	'published',
	'closed',
	'amended',
	'canceled',
	'awarded',
	'archived'
] as const;

export const procurements = sqliteTable('procurements', {
	id: text('id').primaryKey(),
	slug: text('slug').notNull().unique(),
	kind: text('kind', { enum: ['tender', 'auction'] }).notNull(),
	status: text('status', { enum: PROCUREMENT_STATUSES }).notNull().default('draft'),
	publishedAt: text('published_at'),
	/** UTC ISO; entered/displayed in Asia/Tbilisi */
	deadlineAt: text('deadline_at'),
	previousDeadlineAt: text('previous_deadline_at'),
	amendsId: text('amends_id'),
	legacyId: integer('legacy_id'),
	migrationConfidence: text('migration_confidence'),
	...entityMeta
});

export const procurementStatusHistory = sqliteTable('procurement_status_history', {
	id: text('id').primaryKey(),
	procurementId: text('procurement_id')
		.notNull()
		.references(() => procurements.id),
	fromStatus: text('from_status'),
	toStatus: text('to_status').notNull(),
	actorId: text('actor_id'),
	reason: text('reason').notNull(),
	createdAt: text('created_at').notNull()
});

export const procurementI18n = sqliteTable('procurement_i18n', {
	procurementId: text('procurement_id')
		.notNull()
		.references(() => procurements.id),
	locale: localeColumn(),
	title: text('title').notNull().default(''),
	amendmentSummary: text('amendment_summary'),
	...bodyColumns,
	...i18nMeta
});

export const procurementDocs = sqliteTable('procurement_docs', {
	id: text('id').primaryKey(),
	procurementId: text('procurement_id')
		.notNull()
		.references(() => procurements.id),
	mediaId: text('media_id')
		.notNull()
		.references(() => media.id),
	/** null = applies to all locales */
	locale: text('locale', { enum: LOCALES }),
	sort: integer('sort').notNull().default(0),
	revision: integer('revision').notNull().default(1),
	createdAt: text('created_at').notNull()
});

export const procurementDocsI18n = sqliteTable('procurement_docs_i18n', {
	docId: text('doc_id')
		.notNull()
		.references(() => procurementDocs.id),
	locale: localeColumn(),
	title: text('title').notNull().default('')
});

// ---------------------------------------------------------------------------
// Document library (reports & legal)
// ---------------------------------------------------------------------------

export const documents = sqliteTable('documents', {
	id: text('id').primaryKey(),
	slug: text('slug').notNull().unique(),
	category: text('category', { enum: ['financial', 'legal', 'other'] }).notNull(),
	year: integer('year'),
	sort: integer('sort').notNull().default(0),
	status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
	...entityMeta
});

export const documentI18n = sqliteTable('document_i18n', {
	documentId: text('document_id')
		.notNull()
		.references(() => documents.id),
	locale: localeColumn(),
	title: text('title').notNull().default(''),
	description: text('description'),
	...i18nMeta
});

/** Per-locale PDF variants */
export const documentFiles = sqliteTable('document_files', {
	id: text('id').primaryKey(),
	documentId: text('document_id')
		.notNull()
		.references(() => documents.id),
	locale: localeColumn(),
	mediaId: text('media_id')
		.notNull()
		.references(() => media.id)
});

// ---------------------------------------------------------------------------
// Galleries & videos
// ---------------------------------------------------------------------------

export const albums = sqliteTable('albums', {
	id: text('id').primaryKey(),
	slug: text('slug').notNull().unique(),
	coverMediaId: text('cover_media_id'),
	sort: integer('sort').notNull().default(0),
	status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
	publishedAt: text('published_at'),
	...entityMeta
});

export const albumI18n = sqliteTable('album_i18n', {
	albumId: text('album_id')
		.notNull()
		.references(() => albums.id),
	locale: localeColumn(),
	title: text('title').notNull().default(''),
	description: text('description'),
	...i18nMeta
});

export const albumItems = sqliteTable('album_items', {
	albumId: text('album_id')
		.notNull()
		.references(() => albums.id),
	mediaId: text('media_id')
		.notNull()
		.references(() => media.id),
	sort: integer('sort').notNull().default(0)
});

export const videos = sqliteTable('videos', {
	id: text('id').primaryKey(),
	slug: text('slug').notNull().unique(),
	/** self-hosted file in R2 */
	mediaId: text('media_id'),
	/** or an external YouTube id (facade pattern, embed on click) */
	youtubeId: text('youtube_id'),
	thumbMediaId: text('thumb_media_id'),
	sort: integer('sort').notNull().default(0),
	status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
	publishedAt: text('published_at'),
	...entityMeta
});

export const videoI18n = sqliteTable('video_i18n', {
	videoId: text('video_id')
		.notNull()
		.references(() => videos.id),
	locale: localeColumn(),
	title: text('title').notNull().default(''),
	description: text('description'),
	...i18nMeta
});

// ---------------------------------------------------------------------------
// Partners / org / stats / settings / glossary
// ---------------------------------------------------------------------------

export const partners = sqliteTable('partners', {
	id: text('id').primaryKey(),
	url: text('url'),
	logoMediaId: text('logo_media_id'),
	sort: integer('sort').notNull().default(0),
	...entityMeta
});

export const partnerI18n = sqliteTable('partner_i18n', {
	partnerId: text('partner_id')
		.notNull()
		.references(() => partners.id),
	locale: localeColumn(),
	name: text('name').notNull().default('')
});

export const orgUnits = sqliteTable('org_units', {
	id: text('id').primaryKey(),
	parentId: text('parent_id'),
	sort: integer('sort').notNull().default(0),
	...entityMeta
});

export const orgUnitI18n = sqliteTable('org_unit_i18n', {
	orgUnitId: text('org_unit_id')
		.notNull()
		.references(() => orgUnits.id),
	locale: localeColumn(),
	title: text('title').notNull().default(''),
	personName: text('person_name')
});

export const stats = sqliteTable('stats', {
	id: text('id').primaryKey(),
	key: text('key').notNull().unique(),
	value: text('value').notNull(),
	unit: text('unit'),
	sort: integer('sort').notNull().default(0),
	...entityMeta
});

export const statI18n = sqliteTable('stat_i18n', {
	statId: text('stat_id')
		.notNull()
		.references(() => stats.id),
	locale: localeColumn(),
	label: text('label').notNull().default('')
});

export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

export const glossary = sqliteTable('glossary', {
	id: text('id').primaryKey(),
	termKa: text('term_ka').notNull(),
	termEn: text('term_en').notNull(),
	termRu: text('term_ru').notNull(),
	note: text('note'),
	version: integer('version').notNull().default(1)
});

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export const submissions = sqliteTable('submissions', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull(),
	subject: text('subject').notNull(),
	message: text('message').notNull(),
	ipHash: text('ip_hash'),
	uaHash: text('ua_hash'),
	createdAt: text('created_at').notNull(),
	handled: integer('handled').notNull().default(0),
	purgeAfter: text('purge_after').notNull()
});

export const redirects = sqliteTable('redirects', {
	oldPath: text('old_path').primaryKey(),
	newPath: text('new_path').notNull(),
	statusCode: integer('status_code').notNull().default(301),
	locale: text('locale'),
	note: text('note')
});

export const jobs = sqliteTable('jobs', {
	id: text('id').primaryKey(),
	type: text('type').notNull(),
	status: text('status', { enum: ['queued', 'running', 'done', 'failed'] }).notNull(),
	payloadJson: text('payload_json'),
	createdAt: text('created_at').notNull(),
	createdBy: text('created_by')
});

export const jobItems = sqliteTable('job_items', {
	id: text('id').primaryKey(),
	jobId: text('job_id')
		.notNull()
		.references(() => jobs.id),
	idempotencyKey: text('idempotency_key').notNull().unique(),
	entityRef: text('entity_ref').notNull(),
	status: text('status', {
		enum: ['queued', 'running', 'done', 'failed', 'dead']
	}).notNull(),
	attempts: integer('attempts').notNull().default(0),
	lastError: text('last_error'),
	resultJson: text('result_json'),
	startedAt: text('started_at'),
	finishedAt: text('finished_at')
});

/** FTS5 virtual table — maintained by application writes, not triggers */
export const searchIndexFts = sql`
	CREATE VIRTUAL TABLE IF NOT EXISTS search_index_fts USING fts5(
		entity,
		entity_id UNINDEXED,
		locale UNINDEXED,
		title,
		body_text,
		tokenize='unicode61'
	)
`;
