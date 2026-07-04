import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { articleI18n, articles } from '$lib/server/db/schema';
import { desc, eq, like, or, sql } from 'drizzle-orm';
import { adminForm, requireRole } from '$lib/server/admin/guard';
import { slugify } from '$lib/server/content/slug';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	requireRole(locals, 'draft_editor');
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);

	const q = (url.searchParams.get('q') ?? '').trim();
	const filter = q
		? or(like(articles.slug, `%${q}%`), sql`${articles.id} IN (
				SELECT article_id FROM article_i18n WHERE title LIKE ${'%' + q + '%'}
			)`)
		: undefined;

	const rows = await db
		.select({
			id: articles.id,
			slug: articles.slug,
			category: articles.category,
			status: articles.status,
			publishedAt: articles.publishedAt,
			updatedAt: articles.updatedAt,
			title: sql<string>`(SELECT title FROM article_i18n WHERE article_id = ${articles.id} AND locale = 'ka')`
		})
		.from(articles)
		.where(filter)
		.orderBy(desc(articles.updatedAt))
		.limit(100);

	return { items: rows, q, csrf: locals.session!.csrfToken };
};

export const actions: Actions = {
	create: async (event) => {
		const { db, form, session } = await adminForm(event, 'draft_editor');
		const title = String(form.get('title') ?? '').trim();
		const category = String(form.get('category') ?? 'news');
		if (!title) return fail(400, { error: 'სათაური სავალდებულოა' });
		if (!['news', 'announcement', 'publication'].includes(category)) {
			return fail(400, { error: 'Invalid category' });
		}

		const id = crypto.randomUUID();
		const now = new Date().toISOString();
		let slug = slugify(title);
		const existing = await db.select().from(articles).where(eq(articles.slug, slug)).get();
		if (existing) slug = `${slug}-${id.slice(0, 6)}`;

		await db.insert(articles).values({
			id,
			slug,
			category: category as 'news' | 'announcement' | 'publication',
			status: 'draft',
			createdAt: now,
			updatedAt: now,
			createdBy: session.userId,
			updatedBy: session.userId
		});
		await db.insert(articleI18n).values({
			articleId: id,
			locale: 'ka',
			title,
			reviewStatus: 'reviewed'
		});
		await logAudit(db, {
			actorId: session.userId,
			action: 'create',
			entityType: 'article',
			entityId: id
		});

		redirect(303, `/admin/news/${id}`);
	}
};
