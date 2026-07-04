import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import {
	getMediaRefs,
	getSettingsMap,
	listArticles,
	listPartners,
	listProcurements,
	listProjects,
	listStats
} from '$lib/server/content/queries';
import type { Locale } from '$lib/i18n';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);
	const locale = params.locale as Locale;

	const [news, procurement, projects, partners, stats, settingsMap] = await Promise.all([
		listArticles(db, locale, { perPage: 3 }),
		listProcurements(db, locale, { open: true }),
		listProjects(db, locale),
		listPartners(db, locale),
		listStats(db, locale),
		getSettingsMap(db)
	]);

	const heroMediaId = settingsMap.hero_media_id ?? '';
	const heroRefs = heroMediaId ? await getMediaRefs(db, [heroMediaId], locale) : new Map();

	return {
		locale,
		news: news.items,
		procurement: procurement.slice(0, 5),
		projects: projects.slice(0, 3),
		partners,
		stats,
		hero: heroMediaId ? (heroRefs.get(heroMediaId) ?? null) : null
	};
};
