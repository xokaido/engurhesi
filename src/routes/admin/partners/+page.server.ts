import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { media, partnerI18n, partners } from '$lib/server/db/schema';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { adminForm, requireRole } from '$lib/server/admin/guard';
import { logAudit } from '$lib/server/audit';
import { purgeTags } from '$lib/server/cache';

export const load: PageServerLoad = async ({ locals, platform }) => {
	requireRole(locals, 'editor');
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);

	const [rows, i18nRows, logos] = await Promise.all([
		db.select().from(partners).orderBy(asc(partners.sort)),
		db.select().from(partnerI18n),
		db
			.select({ id: media.id, filename: media.originalFilename })
			.from(media)
			.where(and(eq(media.kind, 'image'), eq(media.status, 'active')))
			.orderBy(desc(media.createdAt))
			.limit(200)
	]);

	return { items: rows, i18n: i18nRows, logos, csrf: locals.session!.csrfToken };
};

export const actions: Actions = {
	create: async (event) => {
		const { db, form, session } = await adminForm(event, 'editor');
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'სახელი სავალდებულოა' });

		const id = crypto.randomUUID();
		const now = new Date().toISOString();
		const maxSort = await db
			.select({ max: sql<number>`COALESCE(MAX(sort), 0)` })
			.from(partners)
			.get();

		await db.insert(partners).values({
			id,
			url: String(form.get('url') ?? '').trim() || null,
			logoMediaId: String(form.get('logo') ?? '').trim() || null,
			sort: (maxSort?.max ?? 0) + 1,
			createdAt: now,
			updatedAt: now,
			createdBy: session.userId,
			updatedBy: session.userId
		});
		await db.insert(partnerI18n).values({ partnerId: id, locale: 'ka', name });
		await logAudit(db, { actorId: session.userId, action: 'create', entityType: 'partner', entityId: id });
		await purgeTags(event.platform!.env, ['home']);
		return { created: true };
	},

	setName: async (event) => {
		const { db, form } = await adminForm(event, 'editor');
		const partnerId = String(form.get('partner_id') ?? '');
		const locale = String(form.get('locale') ?? 'ka');
		const name = String(form.get('name') ?? '').trim();
		if (!['ka', 'en', 'ru'].includes(locale) || !name) return fail(400, { error: 'Invalid input' });

		const existing = await db
			.select()
			.from(partnerI18n)
			.where(sql`${partnerI18n.partnerId} = ${partnerId} AND ${partnerI18n.locale} = ${locale}`)
			.get();
		if (existing) {
			await db
				.update(partnerI18n)
				.set({ name })
				.where(sql`${partnerI18n.partnerId} = ${partnerId} AND ${partnerI18n.locale} = ${locale}`);
		} else {
			await db.insert(partnerI18n).values({ partnerId, locale: locale as 'ka' | 'en' | 'ru', name });
		}
		await purgeTags(event.platform!.env, ['home']);
		return { saved: true };
	},

	update: async (event) => {
		const { db, form } = await adminForm(event, 'editor');
		const partnerId = String(form.get('partner_id') ?? '');
		await db
			.update(partners)
			.set({
				url: String(form.get('url') ?? '').trim() || null,
				logoMediaId: String(form.get('logo') ?? '').trim() || null,
				sort: Number(form.get('sort')) || 0,
				updatedAt: new Date().toISOString()
			})
			.where(eq(partners.id, partnerId));
		await purgeTags(event.platform!.env, ['home']);
		return { saved: true };
	},

	delete: async (event) => {
		const { db, form, session } = await adminForm(event, 'admin');
		const id = String(form.get('partner_id') ?? '');
		await db.delete(partnerI18n).where(eq(partnerI18n.partnerId, id));
		await db.delete(partners).where(eq(partners.id, id));
		await logAudit(db, { actorId: session.userId, action: 'delete', entityType: 'partner', entityId: id });
		await purgeTags(event.platform!.env, ['home']);
		return { deleted: true };
	}
};
