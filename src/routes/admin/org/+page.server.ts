import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { orgUnitI18n, orgUnits } from '$lib/server/db/schema';
import { asc, eq, sql } from 'drizzle-orm';
import { adminForm, requireRole } from '$lib/server/admin/guard';
import { logAudit } from '$lib/server/audit';
import { purgeTags } from '$lib/server/cache';

export const load: PageServerLoad = async ({ locals, platform }) => {
	requireRole(locals, 'editor');
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);

	const [units, i18nRows] = await Promise.all([
		db.select().from(orgUnits).orderBy(asc(orgUnits.sort)),
		db.select().from(orgUnitI18n)
	]);

	return { units, i18n: i18nRows, csrf: locals.session!.csrfToken };
};

export const actions: Actions = {
	create: async (event) => {
		const { db, form, session } = await adminForm(event, 'editor');
		const title = String(form.get('title') ?? '').trim();
		if (!title) return fail(400, { error: 'დასახელება სავალდებულოა' });

		const id = crypto.randomUUID();
		const now = new Date().toISOString();
		const maxSort = await db
			.select({ max: sql<number>`COALESCE(MAX(sort), 0)` })
			.from(orgUnits)
			.get();

		await db.insert(orgUnits).values({
			id,
			parentId: String(form.get('parent_id') ?? '').trim() || null,
			sort: (maxSort?.max ?? 0) + 1,
			createdAt: now,
			updatedAt: now,
			createdBy: session.userId,
			updatedBy: session.userId
		});
		await db.insert(orgUnitI18n).values({
			orgUnitId: id,
			locale: 'ka',
			title,
			personName: String(form.get('person') ?? '').trim() || null
		});
		await logAudit(db, { actorId: session.userId, action: 'create', entityType: 'org_unit', entityId: id });
		await purgeTags(event.platform!.env, ['pages']);
		return { created: true };
	},

	setI18n: async (event) => {
		const { db, form } = await adminForm(event, 'editor');
		const orgUnitId = String(form.get('unit_id') ?? '');
		const locale = String(form.get('locale') ?? 'ka');
		const title = String(form.get('title') ?? '').trim();
		const personName = String(form.get('person') ?? '').trim() || null;
		if (!['ka', 'en', 'ru'].includes(locale) || !title) return fail(400, { error: 'Invalid input' });

		const existing = await db
			.select()
			.from(orgUnitI18n)
			.where(sql`${orgUnitI18n.orgUnitId} = ${orgUnitId} AND ${orgUnitI18n.locale} = ${locale}`)
			.get();
		if (existing) {
			await db
				.update(orgUnitI18n)
				.set({ title, personName })
				.where(sql`${orgUnitI18n.orgUnitId} = ${orgUnitId} AND ${orgUnitI18n.locale} = ${locale}`);
		} else {
			await db.insert(orgUnitI18n).values({
				orgUnitId,
				locale: locale as 'ka' | 'en' | 'ru',
				title,
				personName
			});
		}
		await purgeTags(event.platform!.env, ['pages']);
		return { saved: true };
	},

	move: async (event) => {
		const { db, form } = await adminForm(event, 'editor');
		const unitId = String(form.get('unit_id') ?? '');
		const parentId = String(form.get('parent_id') ?? '').trim() || null;
		if (parentId === unitId) return fail(400, { error: 'ერთეული საკუთარი მშობელი ვერ იქნება' });
		await db
			.update(orgUnits)
			.set({
				parentId,
				sort: Number(form.get('sort')) || 0,
				updatedAt: new Date().toISOString()
			})
			.where(eq(orgUnits.id, unitId));
		await purgeTags(event.platform!.env, ['pages']);
		return { saved: true };
	},

	delete: async (event) => {
		const { db, form, session } = await adminForm(event, 'admin');
		const id = String(form.get('unit_id') ?? '');
		const children = await db.select().from(orgUnits).where(eq(orgUnits.parentId, id));
		if (children.length > 0) {
			return fail(400, { error: 'ჯერ წაშალეთ ან გადაიტანეთ ქვედანაყოფები' });
		}
		await db.delete(orgUnitI18n).where(eq(orgUnitI18n.orgUnitId, id));
		await db.delete(orgUnits).where(eq(orgUnits.id, id));
		await logAudit(db, { actorId: session.userId, action: 'delete', entityType: 'org_unit', entityId: id });
		await purgeTags(event.platform!.env, ['pages']);
		return { deleted: true };
	}
};
