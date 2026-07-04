import type { R2Bucket } from '@cloudflare/workers-types';

export const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days safety cap
export const SNAPSHOT_PREFIX = 'snapshots';

export function snapshotKey(locale: string, path: string): string {
	const normalized = path.startsWith('/') ? path : `/${path}`;
	return `${SNAPSHOT_PREFIX}/${locale}${normalized === '/' ? '' : normalized}.html`;
}

export function buildCacheKey(request: Request): string {
	const url = new URL(request.url);
	const allowed = new URLSearchParams();
	for (const [key, value] of url.searchParams) {
		if (key === 'page') allowed.set(key, value);
	}
	const query = allowed.toString();
	return `${url.pathname}${query ? `?${query}` : ''}`;
}

export function cacheTagsHeader(tags: string[]): string {
	return tags.join(',');
}

function cacheKeyRequest(request: Request): Request {
	const url = new URL(buildCacheKey(request), request.url);
	return new Request(url, request);
}

export async function getCachedResponse(
	cache: Cache,
	request: Request
): Promise<Response | undefined> {
	const key = cacheKeyRequest(request);
	const hit = await cache.match(key);
	return hit ?? undefined;
}

export async function putCachedResponse(
	cache: Cache,
	request: Request,
	response: Response,
	tags: string[]
): Promise<void> {
	if (response.headers.has('Set-Cookie')) return;

	const headers = new Headers(response.headers);
	headers.set('Cache-Control', `public, max-age=${CACHE_TTL_SECONDS}`);
	headers.set('Cache-Tag', cacheTagsHeader(tags));

	const key = cacheKeyRequest(request);
	await cache.put(
		key,
		new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers
		})
	);
}

export async function writeHtmlSnapshot(
	bucket: R2Bucket,
	locale: string,
	path: string,
	html: string
): Promise<void> {
	await bucket.put(snapshotKey(locale, path), html, {
		httpMetadata: { contentType: 'text/html; charset=utf-8' }
	});
}

export async function readHtmlSnapshot(
	bucket: R2Bucket,
	locale: string,
	path: string
): Promise<string | null> {
	const obj = await bucket.get(snapshotKey(locale, path));
	if (!obj) return null;
	return obj.text();
}

export async function purgeCacheTags(
	accountId: string,
	apiToken: string,
	zoneId: string,
	tags: string[]
): Promise<void> {
	const res = await fetch(
		`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ tags })
		}
	);
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Cache purge failed (${res.status}): ${body}`);
	}
}

/**
 * Purge-on-publish entry point. Uses the Cloudflare API when a scoped token is
 * configured; otherwise (local dev / preview without token) it is a logged
 * no-op — freshness then relies on the TTL safety cap.
 */
export async function purgeTags(
	env: {
		CF_API_TOKEN?: string;
		CF_ZONE_ID?: string;
		CF_ACCOUNT_ID?: string;
	},
	tags: string[]
): Promise<void> {
	if (!env.CF_API_TOKEN || !env.CF_ZONE_ID) {
		console.log('[cache] purge skipped (no CF token configured):', tags.join(','));
		return;
	}
	try {
		await purgeCacheTags(env.CF_ACCOUNT_ID ?? '', env.CF_API_TOKEN, env.CF_ZONE_ID, tags);
	} catch (err) {
		console.error('[cache] purge failed:', err);
	}
}

export function staleSnapshotResponse(html: string): Response {
	return new Response(html, {
		status: 200,
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'no-store',
			'x-served-stale': '1'
		}
	});
}

export function serviceUnavailableResponse(): Response {
	return new Response(
		`<!doctype html><html lang="ka"><head><meta charset="utf-8"><title>Service unavailable</title></head><body><h1>503 Service Unavailable</h1><p>Please try again later.</p></body></html>`,
		{
			status: 503,
			headers: {
				'Content-Type': 'text/html; charset=utf-8',
				'Cache-Control': 'no-store'
			}
		}
	);
}
