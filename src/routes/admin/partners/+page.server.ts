import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { media, partnerI18n, partners } from '$lib/server/db/schema';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { adminForm, requireRole } from '$lib/server/admin/guard';
import { resolveTrilingual, triFromForm } from '$lib/server/admin/i18n-forms';
import { logAudit } from '$lib/server/audit';
import { purgeTags } from '$lib/server/cache';

async function upsertName(
  db: ReturnType<typeof createDb>,
  partnerId: string,
  locale: 'ka' | 'en' | 'ru',
  name: string
) {
  if (!name) return;
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
    await db.insert(partnerI18n).values({ partnerId, locale, name });
  }
}

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
    const { d1, db, form, session, env } = await adminForm(event, 'editor');
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
    const { values, warning } = await resolveTrilingual(d1, env, {
      name: { ka: name, en: '', ru: '' }
    });
    for (const locale of ['ka', 'en', 'ru'] as const) {
      await upsertName(db, id, locale, values.name[locale]);
    }
    await logAudit(db, {
      actorId: session.userId,
      action: 'create',
      entityType: 'partner',
      entityId: id
    });
    await purgeTags(event.platform!.env, ['home']);
    return { created: true, warning };
  },

  setNames: async (event) => {
    const { d1, db, form, env } = await adminForm(event, 'editor');
    const partnerId = String(form.get('partner_id') ?? '');
    const input = triFromForm(form, 'name');
    if (!input.ka) return fail(400, { error: 'ქართული სახელი სავალდებულოა' });

    const { values, warning } = await resolveTrilingual(d1, env, { name: input });
    for (const locale of ['ka', 'en', 'ru'] as const) {
      await upsertName(db, partnerId, locale, values.name[locale]);
    }
    await purgeTags(event.platform!.env, ['home']);
    return { saved: true, warning };
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
    await logAudit(db, {
      actorId: session.userId,
      action: 'delete',
      entityType: 'partner',
      entityId: id
    });
    await purgeTags(event.platform!.env, ['home']);
    return { deleted: true };
  }
};
