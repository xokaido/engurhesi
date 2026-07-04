import type { D1Database } from '@cloudflare/workers-types';
import { createDb } from '../db/client';
import { logAudit } from '../audit';
import { purgeTags } from '../cache';
import { reindexEntity, type RichEntityType } from '../content/save';

const TABLE: Record<RichEntityType | 'document' | 'album' | 'video', string> = {
	article: 'articles',
	page: 'pages',
	project: 'projects',
	procurement: 'procurements',
	document: 'documents',
	album: 'albums',
	video: 'videos'
};

const PURGE_TAGS: Record<string, string[]> = {
	article: ['home', 'news', 'sitemap'],
	page: ['home', 'pages', 'sitemap'],
	project: ['home', 'projects', 'sitemap'],
	procurement: ['home', 'proc', 'sitemap'],
	document: ['pages'],
	album: ['gallery', 'sitemap'],
	video: ['gallery']
};

export async function setPublishStatus(
	d1: D1Database,
	env: { CF_API_TOKEN?: string; CF_ZONE_ID?: string; CF_ACCOUNT_ID?: string },
	entityType: keyof typeof TABLE,
	entityId: string,
	publish: boolean,
	actorId: string
): Promise<void> {
	const table = TABLE[entityType];
	const now = new Date().toISOString();
	// projects and documents have no published_at column
	const hasPublishedAt = !['projects', 'documents'].includes(table);

	if (publish) {
		await d1
			.prepare(
				hasPublishedAt
					? `UPDATE ${table} SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ?, updated_by = ? WHERE id = ?`
					: `UPDATE ${table} SET status = 'published', updated_at = ?, updated_by = ? WHERE id = ?`
			)
			.bind(...(hasPublishedAt ? [now, now, actorId, entityId] : [now, actorId, entityId]))
			.run();
	} else {
		await d1
			.prepare(
				`UPDATE ${table} SET status = 'draft', updated_at = ?, updated_by = ? WHERE id = ?`
			)
			.bind(now, actorId, entityId)
			.run();
	}

	if (
		entityType === 'article' ||
		entityType === 'page' ||
		entityType === 'project' ||
		entityType === 'procurement' ||
		entityType === 'document'
	) {
		await reindexEntity(d1, entityType, entityId);
	}

	await logAudit(createDb(d1), {
		actorId,
		action: publish ? 'publish' : 'unpublish',
		entityType,
		entityId
	});

	await purgeTags(env, PURGE_TAGS[entityType] ?? []);
}

export async function purgeForEntity(
	env: { CF_API_TOKEN?: string; CF_ZONE_ID?: string; CF_ACCOUNT_ID?: string },
	entityType: string
): Promise<void> {
	await purgeTags(env, PURGE_TAGS[entityType] ?? []);
}
