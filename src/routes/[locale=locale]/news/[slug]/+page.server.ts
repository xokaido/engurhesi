import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { getArticle, getMediaRefs, listArticles } from '$lib/server/content/queries';
import { articleMedia } from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';
import type { Locale } from '$lib/i18n';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);
	const locale = params.locale as Locale;

	const article = await getArticle(db, locale, params.slug);
	if (!article) error(404, 'Not found');

	const galleryRows = await db
		.select({ mediaId: articleMedia.mediaId })
		.from(articleMedia)
		.where(eq(articleMedia.articleId, article.id))
		.orderBy(asc(articleMedia.sort));
	const galleryRefs = await getMediaRefs(
		db,
		galleryRows.map((r) => r.mediaId),
		locale
	);
	const gallery = galleryRows.flatMap((r) => {
		const ref = galleryRefs.get(r.mediaId);
		return ref ? [ref] : [];
	});

	const more = await listArticles(db, locale, { perPage: 4 });

	return {
		locale,
		article,
		gallery,
		more: more.items.filter((i) => i.slug !== article.slug).slice(0, 3)
	};
};
