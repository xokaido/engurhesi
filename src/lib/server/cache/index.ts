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
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tags })
  });
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
  const html = `<!doctype html>
<html lang="ka">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>503 — engurhesi.ge</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:'FiraGO','Noto Sans Georgian','Noto Sans','Helvetica Neue',Arial,system-ui,sans-serif;background:radial-gradient(120% 160% at 100% 0%,rgb(8 145 178/.35) 0%,transparent 55%),linear-gradient(160deg,#072a42 0%,#0b3c5d 65%,#0d4a70 100%);padding:1.5rem}
.card{width:100%;max-width:30rem;background:#fff;border-radius:1rem;padding:2.5rem 2rem;text-align:center;box-shadow:0 32px 80px -24px rgb(0 0 0/.6)}
.status{font-size:4.5rem;font-weight:800;line-height:1;margin:0 0 .5rem;color:#0b3c5d;letter-spacing:-.02em}
h1{font-size:1.25rem;margin:0 0 .625rem;color:#072a42}
p{margin:0;color:#5c718a;font-size:.9375rem;line-height:1.6}
</style>
</head>
<body>
<main class="card">
<svg viewBox="0 0 40 40" width="52" height="52" aria-hidden="true"><rect width="40" height="40" rx="9" fill="#0b3c5d"/><path d="M7 29 Q 20 7 33 29" fill="none" stroke="#67e8f9" stroke-width="3.25" stroke-linecap="round"/><path d="M12.5 29 Q 20 15.5 27.5 29" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".9"/><path d="M6 33.5 h28" stroke="#67e8f9" stroke-width="2.25" stroke-linecap="round" opacity=".75"/></svg>
<p class="status">503</p>
<h1>სერვისი დროებით მიუწვდომელია · Service temporarily unavailable</h1>
<p>სცადეთ თავიდან რამდენიმე წუთში. · Please try again in a few minutes.</p>
</main>
</body>
</html>`;
  return new Response(html, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}
