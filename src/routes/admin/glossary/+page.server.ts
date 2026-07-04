import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { glossary } from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';
import { adminForm, requireRole } from '$lib/server/admin/guard';

export const load: PageServerLoad = async ({ locals, platform }) => {
	requireRole(locals, 'editor');
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);
	const rows = await db.select().from(glossary).orderBy(asc(glossary.termKa));
	return { items: rows, csrf: locals.session!.csrfToken };
};

export const actions: Actions = {
	create: async (event) => {
		const { db, form } = await adminForm(event, 'editor');
		const termKa = String(form.get('term_ka') ?? '').trim();
		const termEn = String(form.get('term_en') ?? '').trim();
		const termRu = String(form.get('term_ru') ?? '').trim();
		if (!termKa || !termEn || !termRu) {
			return fail(400, { error: 'სამივე ენის ტერმინი სავალდებულოა' });
		}
		await db.insert(glossary).values({
			id: crypto.randomUUID(),
			termKa,
			termEn,
			termRu,
			note: String(form.get('note') ?? '').trim() || null
		});
		return { created: true };
	},

	update: async (event) => {
		const { db, form } = await adminForm(event, 'editor');
		const id = String(form.get('id') ?? '');
		const termKa = String(form.get('term_ka') ?? '').trim();
		const termEn = String(form.get('term_en') ?? '').trim();
		const termRu = String(form.get('term_ru') ?? '').trim();
		if (!termKa || !termEn || !termRu) {
			return fail(400, { error: 'სამივე ენის ტერმინი სავალდებულოა' });
		}
		const existing = await db.select().from(glossary).where(eq(glossary.id, id)).get();
		if (!existing) return fail(404, { error: 'Not found' });
		await db
			.update(glossary)
			.set({
				termKa,
				termEn,
				termRu,
				note: String(form.get('note') ?? '').trim() || null,
				version: existing.version + 1
			})
			.where(eq(glossary.id, id));
		return { saved: true };
	},

	delete: async (event) => {
		const { db, form } = await adminForm(event, 'admin');
		await db.delete(glossary).where(eq(glossary.id, String(form.get('id') ?? '')));
		return { deleted: true };
	}
};
