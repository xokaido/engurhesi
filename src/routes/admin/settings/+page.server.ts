import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { media, settings } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { adminForm, requireRole } from '$lib/server/admin/guard';
import { logAudit } from '$lib/server/audit';
import { purgeTags } from '$lib/server/cache';

/** Editable settings surfaced in the admin, with Georgian labels. */
const KNOWN_KEYS: { key: string; label: string; kind: 'text' | 'media' }[] = [
	{ key: 'contact_address', label: 'მისამართი (ქა)', kind: 'text' },
	{ key: 'contact_address_en', label: 'მისამართი (EN)', kind: 'text' },
	{ key: 'contact_address_ru', label: 'მისამართი (РУ)', kind: 'text' },
	{ key: 'contact_phone', label: 'ტელეფონი', kind: 'text' },
	{ key: 'contact_email', label: 'ელფოსტა', kind: 'text' },
	{ key: 'hero_media_id', label: 'მთავარი გვერდის სურათი', kind: 'media' },
	{ key: 'facebook_url', label: 'Facebook', kind: 'text' },
	{ key: 'youtube_url', label: 'YouTube', kind: 'text' }
];

export const load: PageServerLoad = async ({ locals, platform }) => {
	requireRole(locals, 'admin');
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);

	const [rows, images] = await Promise.all([
		db.select().from(settings),
		db
			.select({ id: media.id, filename: media.originalFilename })
			.from(media)
			.where(and(eq(media.kind, 'image'), eq(media.status, 'active')))
			.orderBy(desc(media.createdAt))
			.limit(200)
	]);

	const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
	return { map, knownKeys: KNOWN_KEYS, images, csrf: locals.session!.csrfToken };
};

export const actions: Actions = {
	save: async (event) => {
		const { db, form, session } = await adminForm(event, 'admin');

		for (const { key } of KNOWN_KEYS) {
			if (!form.has(key)) continue;
			const value = String(form.get(key) ?? '').trim();
			const existing = await db.select().from(settings).where(eq(settings.key, key)).get();
			if (value) {
				if (existing) {
					await db.update(settings).set({ value }).where(eq(settings.key, key));
				} else {
					await db.insert(settings).values({ key, value });
				}
			} else if (existing) {
				await db.delete(settings).where(eq(settings.key, key));
			}
		}

		await logAudit(db, {
			actorId: session.userId,
			action: 'update',
			entityType: 'settings',
			entityId: 'global'
		});
		await purgeTags(event.platform!.env, ['home', 'pages']);
		return { saved: true };
	}
};
