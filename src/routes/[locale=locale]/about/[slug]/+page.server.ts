import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { getPage, listDocuments, listOrgTree } from '$lib/server/content/queries';
import type { Locale } from '$lib/i18n';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);
	const locale = params.locale as Locale;

	const page = await getPage(db, locale, params.slug);
	if (!page) error(404, 'Not found');

	// Special sections rendered alongside the page body
	const orgTree = params.slug === 'management' ? await listOrgTree(db, locale) : null;
	const documents = params.slug === 'reports' ? await listDocuments(db, locale) : null;

	return { locale, page, orgTree, documents };
};
