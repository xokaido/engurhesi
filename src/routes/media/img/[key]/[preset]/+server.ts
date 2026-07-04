import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db/client';
import { media } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { isPresetAllowed } from '$lib/server/media/validation';
import { serveImagePreset } from '$lib/server/media/serve';
import { getCachedResponse } from '$lib/server/cache';

export const GET: RequestHandler = async ({ params, platform, request }) => {
	const env = platform?.env;
	if (!env) return new Response('Unavailable', { status: 503 });

	const preset = params.preset ?? '';
	if (!isPresetAllowed(preset)) return new Response('Invalid preset', { status: 404 });

	const cache = (() => {
		try {
			return platform?.caches?.default as Cache | undefined;
		} catch {
			return undefined;
		}
	})();
	if (cache) {
		const hit = await getCachedResponse(cache, request).catch(() => undefined);
		if (hit) return hit;
	}

	const db = createDb(env.DB);
	const row = await db.select().from(media).where(eq(media.id, params.key)).get();
	if (!row || row.status !== 'active' || row.kind !== 'image') {
		return new Response('Not found', { status: 404 });
	}

	const isDev = env.ENVIRONMENT === 'development';

	return serveImagePreset(
		env.R2,
		env.IMAGES,
		cache ?? (undefined as unknown as Cache),
		request,
		row.r2Key,
		preset,
		row.id,
		isDev || !cache
	);
};
