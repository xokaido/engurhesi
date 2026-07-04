import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { pageI18n, pages } from '$lib/server/db/schema';
import { asc, eq, sql } from 'drizzle-orm';
import { adminForm, requireRole } from '$lib/server/admin/guard';
import { slugify } from '$lib/server/content/slug';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, platform }) => {
	requireRole(locals, 'draft_editor');
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);

	const rows = await db
		.select({
			id: pages.id,
			slug: pages.slug,
			section: pages.section,
			sort: pages.sort,
			status: pages.status,
			title: sql<string>`(SELECT title FROM page_i18n WHERE page_id = ${pages.id} AND locale = 'ka')`
		})
		.from(pages)
		.orderBy(asc(pages.sort));

	return { items: rows, csrf: locals.session!.csrfToken };
};

export const actions: Actions = {
	create: async (event) => {
		const { db, form, session } = await adminForm(event, 'editor');
		const title = String(form.get('title') ?? '').trim();
		if (!title) return fail(400, { error: 'სათაური სავალდებულოა' });

		const id = crypto.randomUUID();
		const now = new Date().toISOString();
		let slug = slugify(title);
		const existing = await db.select().from(pages).where(eq(pages.slug, slug)).get();
		if (existing) slug = `${slug}-${id.slice(0, 6)}`;

		await db.insert(pages).values({
			id,
			slug,
			section: 'about',
			status: 'draft',
			createdAt: now,
			updatedAt: now,
			createdBy: session.userId,
			updatedBy: session.userId
		});
		await db.insert(pageI18n).values({ pageId: id, locale: 'ka', title, reviewStatus: 'reviewed' });
		await logAudit(db, { actorId: session.userId, action: 'create', entityType: 'page', entityId: id });
		redirect(303, `/admin/pages/${id}`);
	}
};
