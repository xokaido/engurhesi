import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db/client';
import { albums, articles, pages, procurements, projects } from '$lib/server/db/schema';
import { eq, ne } from 'drizzle-orm';
import { LOCALES } from '$lib/i18n';

function urlEntry(origin: string, path: string, lastmod?: string | null): string {
	const alternates = LOCALES.map(
		(l) =>
			`<xhtml:link rel="alternate" hreflang="${l}" href="${origin}/${l}${path === '/' ? '' : path}"/>`
	).join('');
	const xDefault = `<xhtml:link rel="alternate" hreflang="x-default" href="${origin}/ka${path === '/' ? '' : path}"/>`;
	return LOCALES.map(
		(l) =>
			`<url><loc>${origin}/${l}${path === '/' ? '' : path}</loc>${
				lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''
			}${alternates}${xDefault}</url>`
	).join('');
}

export const GET: RequestHandler = async ({ platform, url }) => {
	if (!platform?.env?.DB) return new Response('Unavailable', { status: 503 });
	const db = createDb(platform.env.DB);
	const origin = url.origin;

	const [articleRows, pageRows, procRows, projectRows, albumRows] = await Promise.all([
		db
			.select({ slug: articles.slug, updatedAt: articles.updatedAt })
			.from(articles)
			.where(eq(articles.status, 'published')),
		db
			.select({ slug: pages.slug, updatedAt: pages.updatedAt })
			.from(pages)
			.where(eq(pages.status, 'published')),
		db
			.select({ slug: procurements.slug, updatedAt: procurements.updatedAt })
			.from(procurements)
			.where(ne(procurements.status, 'draft')),
		db
			.select({ slug: projects.slug, updatedAt: projects.updatedAt })
			.from(projects)
			.where(eq(projects.status, 'published')),
		db
			.select({ slug: albums.slug, updatedAt: albums.updatedAt })
			.from(albums)
			.where(eq(albums.status, 'published'))
	]);

	const entries = [
		urlEntry(origin, '/'),
		urlEntry(origin, '/about'),
		urlEntry(origin, '/news'),
		urlEntry(origin, '/procurement'),
		urlEntry(origin, '/projects'),
		urlEntry(origin, '/media'),
		urlEntry(origin, '/contact'),
		...pageRows.map((r) => urlEntry(origin, `/about/${r.slug}`, r.updatedAt)),
		...articleRows.map((r) => urlEntry(origin, `/news/${r.slug}`, r.updatedAt)),
		...procRows.map((r) => urlEntry(origin, `/procurement/${r.slug}`, r.updatedAt)),
		...projectRows.map((r) => urlEntry(origin, `/projects/${r.slug}`, r.updatedAt)),
		...albumRows.map((r) => urlEntry(origin, `/media/${r.slug}`, r.updatedAt))
	].join('\n');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries}
</urlset>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600',
			'Cache-Tag': 'sitemap'
		}
	});
};
