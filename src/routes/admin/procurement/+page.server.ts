import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { procurementI18n, procurements } from '$lib/server/db/schema';
import { desc, sql, eq } from 'drizzle-orm';
import { adminForm, requireRole, tbilisiToUtcIso } from '$lib/server/admin/guard';
import { slugify } from '$lib/server/content/slug';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, platform }) => {
	requireRole(locals, 'draft_editor');
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);

	const rows = await db
		.select({
			id: procurements.id,
			slug: procurements.slug,
			kind: procurements.kind,
			status: procurements.status,
			deadlineAt: procurements.deadlineAt,
			publishedAt: procurements.publishedAt,
			title: sql<string>`(SELECT title FROM procurement_i18n WHERE procurement_id = ${procurements.id} AND locale = 'ka')`
		})
		.from(procurements)
		.orderBy(desc(procurements.updatedAt))
		.limit(200);

	return { items: rows, csrf: locals.session!.csrfToken };
};

export const actions: Actions = {
	// procurement is legal content — creation requires editor, never draft_editor
	create: async (event) => {
		const { db, form, session } = await adminForm(event, 'editor');
		const title = String(form.get('title') ?? '').trim();
		const kind = String(form.get('kind') ?? 'tender');
		const deadline = tbilisiToUtcIso(String(form.get('deadline') ?? ''));
		if (!title) return fail(400, { error: 'სათაური სავალდებულოა' });
		if (!['tender', 'auction'].includes(kind)) return fail(400, { error: 'Invalid kind' });

		const id = crypto.randomUUID();
		const now = new Date().toISOString();
		let slug = slugify(title);
		const existing = await db.select().from(procurements).where(eq(procurements.slug, slug)).get();
		if (existing) slug = `${slug}-${id.slice(0, 6)}`;

		await db.insert(procurements).values({
			id,
			slug,
			kind: kind as 'tender' | 'auction',
			status: 'draft',
			deadlineAt: deadline,
			createdAt: now,
			updatedAt: now,
			createdBy: session.userId,
			updatedBy: session.userId
		});
		await db.insert(procurementI18n).values({
			procurementId: id,
			locale: 'ka',
			title,
			reviewStatus: 'reviewed'
		});
		await logAudit(db, {
			actorId: session.userId,
			action: 'create',
			entityType: 'procurement',
			entityId: id
		});
		redirect(303, `/admin/procurement/${id}`);
	}
};
