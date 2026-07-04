import type { Actions, PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { submissions } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { adminForm, requireRole } from '$lib/server/admin/guard';

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	requireRole(locals, 'editor');
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);

	const showHandled = url.searchParams.get('all') === '1';
	const rows = await db
		.select()
		.from(submissions)
		.where(showHandled ? undefined : eq(submissions.handled, 0))
		.orderBy(desc(submissions.createdAt))
		.limit(200);

	return { items: rows, showHandled, csrf: locals.session!.csrfToken };
};

export const actions: Actions = {
	markHandled: async (event) => {
		const { db, form } = await adminForm(event, 'editor');
		const id = String(form.get('id') ?? '');
		const handled = String(form.get('handled')) === '1' ? 1 : 0;
		await db.update(submissions).set({ handled }).where(eq(submissions.id, id));
		return { saved: true };
	},

	delete: async (event) => {
		const { db, form } = await adminForm(event, 'admin');
		const id = String(form.get('id') ?? '');
		await db.delete(submissions).where(eq(submissions.id, id));
		return { deleted: true };
	}
};
