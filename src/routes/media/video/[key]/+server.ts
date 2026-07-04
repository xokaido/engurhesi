import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db/client';
import { media } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { serveVideoRange } from '$lib/server/media/serve';

export const GET: RequestHandler = async ({ params, platform, request }) => {
	const env = platform?.env;
	if (!env) return new Response('Unavailable', { status: 503 });

	const db = createDb(env.DB);
	const row = await db.select().from(media).where(eq(media.id, params.key)).get();
	if (!row || row.status !== 'active' || row.kind !== 'video') {
		return new Response('Not found', { status: 404 });
	}

	return serveVideoRange(env.R2, row.r2Key, request);
};
