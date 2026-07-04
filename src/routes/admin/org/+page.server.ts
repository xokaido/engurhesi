import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { orgUnitI18n, orgUnits } from '$lib/server/db/schema';
import { asc, eq, sql } from 'drizzle-orm';
import { adminForm, requireRole } from '$lib/server/admin/guard';
import { resolveTrilingual, triFromForm } from '$lib/server/admin/i18n-forms';
import { logAudit } from '$lib/server/audit';
import { purgeTags } from '$lib/server/cache';

async function upsertUnitI18n(
  db: ReturnType<typeof createDb>,
  orgUnitId: string,
  locale: 'ka' | 'en' | 'ru',
  title: string,
  personName: string | null
) {
  if (!title) return;
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
    await db.insert(orgUnitI18n).values({ orgUnitId, locale, title, personName });
  }
}

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
    const { d1, db, form, session, env } = await adminForm(event, 'editor');
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
    const person = String(form.get('person') ?? '').trim();
    const { values, warning } = await resolveTrilingual(d1, env, {
      title: { ka: title, en: '', ru: '' },
      person: { ka: person, en: '', ru: '' }
    });
    for (const locale of ['ka', 'en', 'ru'] as const) {
      await upsertUnitI18n(db, id, locale, values.title[locale], values.person[locale] || null);
    }
    await logAudit(db, {
      actorId: session.userId,
      action: 'create',
      entityType: 'org_unit',
      entityId: id
    });
    await purgeTags(event.platform!.env, ['pages']);
    return { created: true, warning };
  },

  setI18n: async (event) => {
    const { d1, db, form, env } = await adminForm(event, 'editor');
    const orgUnitId = String(form.get('unit_id') ?? '');
    const title = triFromForm(form, 'title');
    const person = triFromForm(form, 'person');
    if (!title.ka) return fail(400, { error: 'ქართული დასახელება სავალდებულოა' });

    const { values, warning } = await resolveTrilingual(d1, env, { title, person });
    for (const locale of ['ka', 'en', 'ru'] as const) {
      await upsertUnitI18n(
        db,
        orgUnitId,
        locale,
        values.title[locale],
        values.person[locale] || null
      );
    }
    await purgeTags(event.platform!.env, ['pages']);
    return { saved: true, warning };
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
    await logAudit(db, {
      actorId: session.userId,
      action: 'delete',
      entityType: 'org_unit',
      entityId: id
    });
    await purgeTags(event.platform!.env, ['pages']);
    return { deleted: true };
  }
};
