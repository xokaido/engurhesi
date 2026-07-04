import type { D1Database } from '@cloudflare/workers-types';
// relative import (not $lib) so the custom worker entry can bundle this file
import { LOCALES, type Locale } from '../../i18n';
import {
	renderDocument,
	sourceHashOf,
	validateDocument,
	CONTENT_SCHEMA_VERSION
} from '../render/prosemirror';

/**
 * Config-driven persistence for the four rich-text entity families. Table
 * names come exclusively from this whitelist — never from user input.
 */
export const RICH_ENTITIES = {
	article: {
		table: 'articles',
		i18nTable: 'article_i18n',
		fk: 'article_id',
		extras: ['excerpt', 'seo_description'] as string[]
	},
	page: {
		table: 'pages',
		i18nTable: 'page_i18n',
		fk: 'page_id',
		extras: ['seo_title', 'seo_description'] as string[]
	},
	project: {
		table: 'projects',
		i18nTable: 'project_i18n',
		fk: 'project_id',
		extras: ['summary'] as string[]
	},
	procurement: {
		table: 'procurements',
		i18nTable: 'procurement_i18n',
		fk: 'procurement_id',
		extras: ['amendment_summary'] as string[]
	}
} as const;

export type RichEntityType = keyof typeof RICH_ENTITIES;

export interface SaveI18nInput {
	title: string;
	bodyJson?: string | null;
	extras?: Record<string, string | null>;
	/** set by the translation pipeline */
	machine?: {
		model: string;
		provider: string;
		promptVersion: string;
		sourceHash: string;
	};
	reviewed?: boolean;
}

export interface SaveResult {
	ok: boolean;
	error?: string;
}

/**
 * Upsert one locale row of a rich entity: validate + render body, maintain
 * review_status / source_hash / stale_source, snapshot a content revision.
 */
export async function saveEntityI18n(
	d1: D1Database,
	entityType: RichEntityType,
	entityId: string,
	locale: Locale,
	input: SaveI18nInput,
	actorId: string | null
): Promise<SaveResult> {
	const cfg = RICH_ENTITIES[entityType];
	const now = new Date().toISOString();

	let bodyHtml: string | null = null;
	let bodyText: string | null = null;
	if (input.bodyJson) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(input.bodyJson);
		} catch {
			return { ok: false, error: 'Body is not valid JSON' };
		}
		const valid = validateDocument(parsed);
		if (!valid.ok) return { ok: false, error: `Invalid content: ${valid.error}` };
		const rendered = renderDocument(parsed);
		bodyHtml = rendered.html;
		bodyText = rendered.text;
	}

	const existing = await d1
		.prepare(`SELECT locale, review_status, source_hash FROM ${cfg.i18nTable} WHERE ${cfg.fk} = ?`)
		.bind(entityId)
		.all<{ locale: string; review_status: string; source_hash: string | null }>();
	const existingRow = (existing.results ?? []).find((r) => r.locale === locale);

	// Determine review metadata
	let reviewStatus: string;
	let translationCols: Record<string, string | null> = {
		translation_model: null,
		translation_provider: null,
		prompt_version: null,
		translated_at: null,
		source_hash: null
	};
	if (locale === 'ka') {
		reviewStatus = 'reviewed'; // KA is the controlling source
		translationCols.source_hash = await sourceHashOf(input.title, input.bodyJson ?? null);
	} else if (input.machine) {
		// machine output never overwrites human_edited/reviewed content
		if (
			existingRow &&
			(existingRow.review_status === 'human_edited' || existingRow.review_status === 'reviewed')
		) {
			return { ok: false, error: 'Human-edited translation would be overwritten' };
		}
		reviewStatus = 'machine';
		translationCols = {
			translation_model: input.machine.model,
			translation_provider: input.machine.provider,
			prompt_version: input.machine.promptVersion,
			translated_at: now,
			source_hash: input.machine.sourceHash
		};
	} else if (input.reviewed) {
		reviewStatus = 'reviewed';
	} else {
		reviewStatus = input.title.trim() === '' && !input.bodyJson ? 'missing' : 'human_edited';
	}

	const extraCols = cfg.extras.filter((c) => input.extras && c in input.extras);
	const extraValues = extraCols.map((c) => input.extras![c]);

	if (existingRow) {
		const sets = [
			'title = ?',
			'body_json = ?',
			'body_html = ?',
			'body_text = ?',
			'content_schema_version = ?',
			'review_status = ?',
			'stale_source = 0',
			...(locale === 'ka' || input.machine
				? [
						'translation_model = ?',
						'translation_provider = ?',
						'prompt_version = ?',
						'translated_at = ?',
						'source_hash = ?'
					]
				: []),
			...(input.reviewed ? ['reviewed_at = ?', 'reviewed_by = ?'] : []),
			...extraCols.map((c) => `${c} = ?`)
		];
		const binds: (string | number | null)[] = [
			input.title,
			input.bodyJson ?? null,
			bodyHtml,
			bodyText,
			CONTENT_SCHEMA_VERSION,
			reviewStatus
		];
		if (locale === 'ka' || input.machine) {
			binds.push(
				translationCols.translation_model,
				translationCols.translation_provider,
				translationCols.prompt_version,
				translationCols.translated_at,
				translationCols.source_hash
			);
		}
		if (input.reviewed) binds.push(now, actorId);
		binds.push(...extraValues);
		binds.push(entityId, locale);

		await d1
			.prepare(
				`UPDATE ${cfg.i18nTable} SET ${sets.join(', ')} WHERE ${cfg.fk} = ? AND locale = ?`
			)
			.bind(...binds)
			.run();
	} else {
		const cols = [
			cfg.fk,
			'locale',
			'title',
			'body_json',
			'body_html',
			'body_text',
			'content_schema_version',
			'review_status',
			'stale_source',
			'translation_model',
			'translation_provider',
			'prompt_version',
			'translated_at',
			'source_hash',
			...extraCols
		];
		const binds: (string | number | null)[] = [
			entityId,
			locale,
			input.title,
			input.bodyJson ?? null,
			bodyHtml,
			bodyText,
			CONTENT_SCHEMA_VERSION,
			reviewStatus,
			0,
			translationCols.translation_model,
			translationCols.translation_provider,
			translationCols.prompt_version,
			translationCols.translated_at,
			translationCols.source_hash,
			...extraValues
		];
		await d1
			.prepare(
				`INSERT INTO ${cfg.i18nTable} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
			)
			.bind(...binds)
			.run();
	}

	// KA source change → flip existing translations to stale
	if (locale === 'ka' && existingRow?.source_hash) {
		const newHash = translationCols.source_hash;
		if (newHash && newHash !== existingRow.source_hash) {
			await d1
				.prepare(
					`UPDATE ${cfg.i18nTable} SET stale_source = 1 WHERE ${cfg.fk} = ? AND locale != 'ka' AND review_status != 'missing'`
				)
				.bind(entityId)
				.run();
		}
	}

	// Content revision snapshot (recovery, not just accountability)
	const versionRow = await d1
		.prepare(
			`SELECT COALESCE(MAX(version), 0) + 1 AS v FROM content_revisions WHERE entity_type = ? AND entity_id = ? AND locale = ?`
		)
		.bind(entityType, entityId, locale)
		.first<{ v: number }>();
	const statusRow = await d1
		.prepare(`SELECT status FROM ${cfg.table} WHERE id = ?`)
		.bind(entityId)
		.first<{ status: string }>();
	await d1
		.prepare(
			`INSERT INTO content_revisions (id, entity_type, entity_id, locale, version, title, body_json, derived_hash, status_at_save, actor_id, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			crypto.randomUUID(),
			entityType,
			entityId,
			locale,
			versionRow?.v ?? 1,
			input.title,
			input.bodyJson ?? null,
			translationCols.source_hash,
			statusRow?.status ?? 'draft',
			actorId,
			now
		)
		.run();

	// Touch entity meta
	await d1
		.prepare(
			`UPDATE ${cfg.table} SET updated_at = ?, updated_by = ?, version = version + 1 WHERE id = ?`
		)
		.bind(now, actorId, entityId)
		.run();

	await reindexEntity(d1, entityType, entityId);
	return { ok: true };
}

/**
 * Rebuild the FTS rows for one entity from its current published state —
 * called in the same logical write path as content saves (no triggers).
 */
export async function reindexEntity(
	d1: D1Database,
	entityType: RichEntityType | 'document',
	entityId: string
): Promise<void> {
	const cfg =
		entityType === 'document'
			? { table: 'documents', i18nTable: 'document_i18n', fk: 'document_id' }
			: RICH_ENTITIES[entityType];

	const statements = [
		d1
			.prepare(`DELETE FROM search_index_fts WHERE entity = ? AND entity_id = ?`)
			.bind(entityType, entityId)
	];

	const base = await d1
		.prepare(`SELECT status FROM ${cfg.table} WHERE id = ?`)
		.bind(entityId)
		.first<{ status: string }>();

	const publiclyVisible =
		base &&
		(base.status === 'published' ||
			(entityType === 'procurement' && base.status !== 'draft'));

	if (publiclyVisible) {
		const i18nRows = await d1
			.prepare(
				`SELECT locale, title, ${entityType === 'document' ? "'' AS body_text" : 'COALESCE(body_text, \'\') AS body_text'} FROM ${cfg.i18nTable} WHERE ${cfg.fk} = ?`
			)
			.bind(entityId)
			.all<{ locale: string; title: string; body_text: string }>();
		for (const row of i18nRows.results ?? []) {
			if (!row.title.trim()) continue;
			statements.push(
				d1
					.prepare(
						`INSERT INTO search_index_fts (entity, entity_id, locale, title, body_text) VALUES (?, ?, ?, ?, ?)`
					)
					.bind(entityType, entityId, row.locale, row.title, row.body_text)
			);
		}
	}

	await d1.batch(statements);
}

export async function removeEntityFromIndex(
	d1: D1Database,
	entityType: string,
	entityId: string
): Promise<void> {
	await d1
		.prepare(`DELETE FROM search_index_fts WHERE entity = ? AND entity_id = ?`)
		.bind(entityType, entityId)
		.run();
}

/** All locales that still need a machine translation for an entity. */
export function missingLocales(existing: Array<{ locale: string }>): Locale[] {
	return LOCALES.filter((l) => l !== 'ka' && !existing.some((r) => r.locale === l));
}
