import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { searchContent } from '$lib/server/search/fts';
import type { Locale } from '$lib/i18n';

/** Maps FTS entity types to public URL builders. */
async function urlFor(
	db: import('@cloudflare/workers-types').D1Database,
	locale: string,
	entity: string,
	entityId: string
): Promise<string | null> {
	const table =
		entity === 'article'
			? 'articles'
			: entity === 'page'
				? 'pages'
				: entity === 'procurement'
					? 'procurements'
					: entity === 'project'
						? 'projects'
						: entity === 'document'
							? 'documents'
							: null;
	if (!table) return null;
	const row = await db
		.prepare(`SELECT slug FROM ${table} WHERE id = ?`)
		.bind(entityId)
		.first<{ slug: string }>();
	if (!row) return null;
	switch (entity) {
		case 'article':
			return `/${locale}/news/${row.slug}`;
		case 'page':
			return `/${locale}/about/${row.slug}`;
		case 'procurement':
			return `/${locale}/procurement/${row.slug}`;
		case 'project':
			return `/${locale}/projects/${row.slug}`;
		case 'document':
			return `/${locale}/about/reports`;
		default:
			return null;
	}
}

const ENTITY_BOOST: Record<string, number> = {
	procurement: 0,
	page: 1,
	project: 2,
	document: 3,
	article: 4
};

export const load: PageServerLoad = async ({ params, platform, url, setHeaders }) => {
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const locale = params.locale as Locale;
	setHeaders({ 'Cache-Control': 'no-store' });

	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	if (!q) return { locale, q: '', results: [] };

	// escape FTS special syntax; simple quoted prefix query
	const ftsQuery = `"${q.replace(/"/g, '')}"*`;

	let hits: Awaited<ReturnType<typeof searchContent>> = [];
	try {
		hits = await searchContent(platform.env.DB, ftsQuery, locale, 30);
	} catch {
		hits = [];
	}

	// entity-type boost + keep FTS rank as tiebreak (AGENTS.md §10)
	hits.sort((a, b) => (ENTITY_BOOST[a.entity] ?? 9) - (ENTITY_BOOST[b.entity] ?? 9));

	const results = [];
	for (const hit of hits) {
		const href = await urlFor(platform.env.DB, locale, hit.entity, hit.entityId);
		if (href) results.push({ ...hit, href });
	}

	return { locale, q, results };
};
