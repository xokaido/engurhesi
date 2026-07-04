import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { projectI18n, projects } from '$lib/server/db/schema';
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
			id: projects.id,
			slug: projects.slug,
			sort: projects.sort,
			status: projects.status,
			title: sql<string>`(SELECT title FROM project_i18n WHERE project_id = ${projects.id} AND locale = 'ka')`
		})
		.from(projects)
		.orderBy(asc(projects.sort));

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
		const existing = await db.select().from(projects).where(eq(projects.slug, slug)).get();
		if (existing) slug = `${slug}-${id.slice(0, 6)}`;

		await db.insert(projects).values({
			id,
			slug,
			status: 'draft',
			createdAt: now,
			updatedAt: now,
			createdBy: session.userId,
			updatedBy: session.userId
		});
		await db
			.insert(projectI18n)
			.values({ projectId: id, locale: 'ka', title, reviewStatus: 'reviewed' });
		await logAudit(db, { actorId: session.userId, action: 'create', entityType: 'project', entityId: id });
		redirect(303, `/admin/projects/${id}`);
	}
};
