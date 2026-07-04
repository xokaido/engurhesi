import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { createDb } from '$lib/server/db/client';
import { redirects, sessions, users } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { hashToken, SESSION_COOKIE } from '$lib/server/auth/password';
import {
  getCachedResponse,
  putCachedResponse,
  readHtmlSnapshot,
  serviceUnavailableResponse,
  staleSnapshotResponse,
  writeHtmlSnapshot
} from '$lib/server/cache';
import { isLocale } from '$lib/i18n';

const PUBLIC_SECTIONS = ['about', 'news', 'procurement', 'projects', 'media', 'contact', 'search'];

/** Route-family cache tag (AGENTS.md §2.1). null → never cached. */
function cacheTagFor(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0 || !isLocale(parts[0])) return null;
  const section = parts[1] ?? '';
  if (section === '') return 'home';
  if (section === 'search' || section === 'contact') return null;
  if (section === 'news') return parts[2] ? 'news' : 'news';
  if (section === 'procurement') return 'proc';
  if (section === 'projects') return 'projects';
  if (section === 'media') return 'gallery';
  if (section === 'about') return 'pages';
  return null;
}

const handleSession: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get(SESSION_COOKIE);
  if (token && event.platform?.env?.DB) {
    try {
      const db = createDb(event.platform.env.DB);
      const tokenHash = await hashToken(token, event.platform.env.SESSION_PEPPER ?? '');
      const row = await db
        .select({
          id: sessions.id,
          userId: sessions.userId,
          csrfToken: sessions.csrfToken,
          idleExpiresAt: sessions.idleExpiresAt,
          absoluteExpiresAt: sessions.absoluteExpiresAt,
          lastSeenAt: sessions.lastSeenAt,
          role: users.role,
          name: users.name,
          email: users.email
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.tokenHash, tokenHash))
        .get();

      const now = new Date();
      if (row && now < new Date(row.idleExpiresAt) && now < new Date(row.absoluteExpiresAt)) {
        event.locals.session = {
          id: row.id,
          userId: row.userId,
          role: row.role,
          csrfToken: row.csrfToken,
          name: row.name,
          email: row.email
        };
        // throttle last_seen writes to at most one per 5 minutes
        if (now.getTime() - new Date(row.lastSeenAt).getTime() > 5 * 60 * 1000) {
          await db
            .update(sessions)
            .set({
              lastSeenAt: now.toISOString(),
              idleExpiresAt: new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString()
            })
            .where(eq(sessions.id, row.id));
        }
      }
    } catch {
      // session lookup failure must never break public pages
    }
  }

  if (event.url.pathname.startsWith('/admin') && !event.url.pathname.startsWith('/admin/login')) {
    if (!event.locals.session) {
      return new Response(null, { status: 303, headers: { Location: '/admin/login' } });
    }
  }

  return resolve(event);
};

/** Root and bare-section redirects + legacy URL mapping. */
const handleRedirects: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;

  // bare sections → Georgian default; /media/{img,file,video}/ are asset routes, not the gallery section
  const first = pathname.split('/').filter(Boolean)[0] ?? '';
  const isMediaAsset = /^\/media\/(img|file|video)\//.test(pathname);
  if (PUBLIC_SECTIONS.includes(first) && !isMediaAsset) {
    return new Response(null, {
      status: 308,
      headers: { Location: `/ka${pathname}${event.url.search}` }
    });
  }

  const response = await resolve(event);

  if (response.status === 404 && event.request.method === 'GET' && event.platform?.env?.DB) {
    try {
      const db = createDb(event.platform.env.DB);
      let decoded = pathname;
      try {
        decoded = decodeURIComponent(pathname);
      } catch {
        // keep raw
      }

      const exact = await db.select().from(redirects).where(eq(redirects.oldPath, decoded)).get();
      if (exact) {
        return new Response(exact.statusCode === 410 ? 'Gone' : null, {
          status: exact.statusCode,
          headers: exact.statusCode === 410 ? {} : { Location: exact.newPath }
        });
      }

      // legacy /{locale}/page/{id}-… and /{locale}/news_in/{id}-…
      const legacy = /^\/(ka|en|ru)\/(page|news_in)\/(\d+)/.exec(decoded);
      if (legacy) {
        const [, locale, kind, idStr] = legacy;
        const legacyId = Number(idStr);
        if (kind === 'news_in') {
          const row = await db.get<{ slug: string }>(
            sql`SELECT slug FROM articles WHERE legacy_id = ${legacyId} AND status = 'published'`
          );
          if (row) {
            return new Response(null, {
              status: 301,
              headers: { Location: `/${locale}/news/${row.slug}` }
            });
          }
        } else {
          const page = await db.get<{ slug: string }>(
            sql`SELECT slug FROM pages WHERE legacy_id = ${legacyId} AND status = 'published'`
          );
          if (page) {
            return new Response(null, {
              status: 301,
              headers: { Location: `/${locale}/about/${page.slug}` }
            });
          }
          const proc = await db.get<{ slug: string }>(
            sql`SELECT slug FROM procurements WHERE legacy_id = ${legacyId} AND status != 'draft'`
          );
          if (proc) {
            return new Response(null, {
              status: 301,
              headers: { Location: `/${locale}/procurement/${proc.slug}` }
            });
          }
        }
      }
    } catch {
      // redirect lookup is best-effort
    }
  }

  return response;
};

/**
 * Edge cache + R2 snapshot fallback for public HTML routes (AGENTS.md §2.2).
 * Freshness comes from purge-on-publish; TTL is only a safety cap. On render
 * failure the last good snapshot is served with x-served-stale: 1.
 */
const handleCache: Handle = async ({ event, resolve }) => {
  const tag = cacheTagFor(event.url.pathname);
  const cacheable =
    tag !== null &&
    event.request.method === 'GET' &&
    !event.locals.session &&
    !!event.platform?.env;

  const locale = event.url.pathname.split('/').filter(Boolean)[0] ?? 'ka';
  const cache = (() => {
    try {
      return event.platform?.caches?.default;
    } catch {
      return undefined;
    }
  })();

  if (cacheable && cache) {
    try {
      const hit = await getCachedResponse(cache as Cache, event.request);
      if (hit) return hit;
    } catch {
      // cache read failures fall through to render
    }
  }

  let response: Response;
  try {
    response = await resolve(event);
  } catch (err) {
    if (cacheable && event.platform?.env?.SNAPSHOTS) {
      const snapshot = await readHtmlSnapshot(
        event.platform.env.SNAPSHOTS,
        locale,
        event.url.pathname.replace(`/${locale}`, '') || '/'
      ).catch(() => null);
      if (snapshot) return staleSnapshotResponse(snapshot);
      return serviceUnavailableResponse();
    }
    throw err;
  }

  if (
    cacheable &&
    response.status === 200 &&
    (response.headers.get('Content-Type') ?? '').includes('text/html') &&
    !response.headers.has('Set-Cookie')
  ) {
    const body = await response.clone().text();
    const work = async () => {
      try {
        if (cache) await putCachedResponse(cache as Cache, event.request, response.clone(), [tag]);
        if (event.platform?.env?.SNAPSHOTS) {
          await writeHtmlSnapshot(
            event.platform.env.SNAPSHOTS,
            locale,
            event.url.pathname.replace(`/${locale}`, '') || '/',
            body
          );
        }
      } catch {
        // snapshot/cache write is best-effort
      }
    };
    try {
      event.platform?.context?.waitUntil(work());
    } catch {
      void work();
    }
  }

  return response;
};

const handleHeaders: Handle = async ({ event, resolve }) => {
  const first = event.url.pathname.split('/').filter(Boolean)[0] ?? '';
  const lang = isLocale(first) ? first : 'ka';
  const response = await resolve(event, {
    transformPageChunk: ({ html }) => html.replace('%lang%', lang)
  });
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (event.url.pathname.startsWith('/admin')) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('X-Frame-Options', 'DENY');
  }
  return response;
};

export const handle: Handle = sequence(handleHeaders, handleSession, handleRedirects, handleCache);

export const handleError: HandleServerError = ({ error }) => {
  console.error('[server-error]', error);
  return { message: 'Internal error' };
};

// The Queues consumer and scheduled (cron) handlers live in worker/index.ts,
// which wraps the generated SvelteKit worker (the adapter cannot export them).
