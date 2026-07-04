import type { D1Database } from '@cloudflare/workers-types';

export interface SearchHit {
	entity: string;
	entityId: string;
	locale: string;
	title: string;
	snippet: string;
}

export async function upsertSearchIndex(
	db: D1Database,
	entity: string,
	entityId: string,
	locale: string,
	title: string,
	bodyText: string
): Promise<void> {
	await db
		.prepare('DELETE FROM search_index_fts WHERE entity = ? AND entity_id = ? AND locale = ?')
		.bind(entity, entityId, locale)
		.run();
	await db
		.prepare(
			'INSERT INTO search_index_fts (entity, entity_id, locale, title, body_text) VALUES (?, ?, ?, ?, ?)'
		)
		.bind(entity, entityId, locale, title, bodyText)
		.run();
}

export async function removeSearchIndex(
	db: D1Database,
	entity: string,
	entityId: string,
	locale?: string
): Promise<void> {
	if (locale) {
		await db
			.prepare('DELETE FROM search_index_fts WHERE entity = ? AND entity_id = ? AND locale = ?')
			.bind(entity, entityId, locale)
			.run();
		return;
	}
	await db
		.prepare('DELETE FROM search_index_fts WHERE entity = ? AND entity_id = ?')
		.bind(entity, entityId)
		.run();
}

export async function searchContent(
	db: D1Database,
	query: string,
	locale: string,
	limit = 20
): Promise<SearchHit[]> {
	const rows = await db
		.prepare(
			`SELECT entity, entity_id, locale, title,
				snippet(search_index_fts, 4, '<mark>', '</mark>', '…', 32) AS snippet
			FROM search_index_fts
			WHERE search_index_fts MATCH ? AND locale = ?
			ORDER BY rank
			LIMIT ?`
		)
		.bind(query, locale, limit)
		.all<{ entity: string; entity_id: string; locale: string; title: string; snippet: string }>();

	return (rows.results ?? []).map((row) => ({
		entity: row.entity,
		entityId: row.entity_id,
		locale: row.locale,
		title: row.title,
		snippet: row.snippet
	}));
}
