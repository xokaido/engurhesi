import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { listProcurements } from '$lib/server/content/queries';
import type { Locale } from '$lib/i18n';

export const load: PageServerLoad = async ({ params, platform, url }) => {
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);
	const locale = params.locale as Locale;

	const kindParam = url.searchParams.get('kind');
	const kind = kindParam === 'auction' ? 'auction' : kindParam === 'tender' ? 'tender' : undefined;
	const statusParam = url.searchParams.get('status');
	const open = statusParam === 'closed' ? false : statusParam === 'open' ? true : undefined;

	const items = await listProcurements(db, locale, { kind, open });

	return {
		locale,
		items,
		kind: kind ?? null,
		open: open === undefined ? null : open
	};
};
