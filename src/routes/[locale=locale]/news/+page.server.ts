import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { listArticles } from '$lib/server/content/queries';
import type { Locale } from '$lib/i18n';

const CATEGORIES = ['news', 'announcement', 'publication'];

export const load: PageServerLoad = async ({ params, platform, url }) => {
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);
	const locale = params.locale as Locale;

	const categoryParam = url.searchParams.get('category') ?? '';
	const category = CATEGORIES.includes(categoryParam) ? categoryParam : undefined;
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	const result = await listArticles(db, locale, { category, page, perPage: 9 });

	return { locale, ...result, category: category ?? null };
};
