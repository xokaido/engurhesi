import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { listAlbums, listVideos } from '$lib/server/content/queries';
import type { Locale } from '$lib/i18n';

export const load: PageServerLoad = async ({ params, platform, url }) => {
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);
	const locale = params.locale as Locale;

	const tab = url.searchParams.get('tab') === 'videos' ? 'videos' : 'photos';
	const [albums, videos] = await Promise.all([listAlbums(db, locale), listVideos(db, locale)]);

	return { locale, tab, albums, videos };
};
