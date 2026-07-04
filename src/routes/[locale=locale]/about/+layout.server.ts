import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { listAboutPages } from '$lib/server/content/queries';
import type { Locale } from '$lib/i18n';

export const load: LayoutServerLoad = async ({ params, platform }) => {
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);
	const locale = params.locale as Locale;
	return { locale, aboutPages: await listAboutPages(db, locale) };
};
