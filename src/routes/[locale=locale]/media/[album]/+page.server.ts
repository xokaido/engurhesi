import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { getAlbum } from '$lib/server/content/queries';
import type { Locale } from '$lib/i18n';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);
	const locale = params.locale as Locale;
	const album = await getAlbum(db, locale, params.album);
	if (!album) error(404, 'Not found');
	return { locale, album };
};
