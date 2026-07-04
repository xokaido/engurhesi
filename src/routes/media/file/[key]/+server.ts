import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db/client';
import { media } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { mediaResponseHeaders } from '$lib/server/media/validation';
import { toBody } from '$lib/server/workers-compat';

export const GET: RequestHandler = async ({ params, platform }) => {
	const env = platform?.env;
	if (!env) return new Response('Unavailable', { status: 503 });

	const db = createDb(env.DB);
	const row = await db.select().from(media).where(eq(media.id, params.key)).get();
	if (!row || row.status !== 'active') return new Response('Not found', { status: 404 });

	const obj = await env.R2.get(row.r2Key);
	if (!obj) return new Response('Not found', { status: 404 });

	const mime = row.detectedMime ?? row.declaredMime;
	return new Response(toBody(obj.body), {
		headers: {
			...mediaResponseHeaders(mime, row.originalFilename),
			'Content-Length': String(row.size),
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
