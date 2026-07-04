import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db/client';
import { listStats } from '$lib/server/content/queries';

export const GET: RequestHandler = async ({ platform, url }) => {
	if (!platform?.env?.DB) return new Response('Unavailable', { status: 503 });
	const db = createDb(platform.env.DB);
	const locale = url.searchParams.get('locale');
	const stats = await listStats(db, locale === 'en' || locale === 'ru' ? locale : 'ka');
	return new Response(JSON.stringify({ stats }), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'public, max-age=3600',
			'Cache-Tag': 'stats'
		}
	});
};
