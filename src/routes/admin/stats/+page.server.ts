import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { statI18n, stats } from '$lib/server/db/schema';
import { asc, eq, sql } from 'drizzle-orm';
import { adminForm, requireRole } from '$lib/server/admin/guard';
import { resolveTrilingual, triFromForm } from '$lib/server/admin/i18n-forms';
import { logAudit } from '$lib/server/audit';
import { purgeTags } from '$lib/server/cache';

async function upsertLabel(
  db: ReturnType<typeof createDb>,
  statId: string,
  locale: 'ka' | 'en' | 'ru',
  label: string
) {
  if (!label) return;
  const existing = await db
    .select()
    .from(statI18n)
    .where(sql`${statI18n.statId} = ${statId} AND ${statI18n.locale} = ${locale}`)
    .get();
  if (existing) {
    await db
      .update(statI18n)
      .set({ label })
      .where(sql`${statI18n.statId} = ${statId} AND ${statI18n.locale} = ${locale}`);
  } else {
    await db.insert(statI18n).values({ statId, locale, label });
  }
}

export const load: PageServerLoad = async ({ locals, platform }) => {
  requireRole(locals, 'editor');
  if (!platform?.env?.DB) error(503, 'Database unavailable');
  const db = createDb(platform.env.DB);

  const [rows, i18nRows] = await Promise.all([
    db.select().from(stats).orderBy(asc(stats.sort)),
    db.select().from(statI18n)
  ]);

  return { items: rows, i18n: i18nRows, csrf: locals.session!.csrfToken };
};

export const actions: Actions = {
  create: async (event) => {
    const { d1, db, form, session, env } = await adminForm(event, 'editor');
    const key = String(form.get('key') ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');
    const value = String(form.get('value') ?? '').trim();
    const label = String(form.get('label') ?? '').trim();
    if (!key || !value || !label) return fail(400, { error: 'ყველა ველი სავალდებულოა' });

    const existing = await db.select().from(stats).where(eq(stats.key, key)).get();
    if (existing) return fail(400, { error: 'ეს key უკვე არსებობს' });

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const maxSort = await db
      .select({ max: sql<number>`COALESCE(MAX(sort), 0)` })
      .from(stats)
      .get();

    await db.insert(stats).values({
      id,
      key,
      value,
      unit: String(form.get('unit') ?? '').trim() || null,
      sort: (maxSort?.max ?? 0) + 1,
      createdAt: now,
      updatedAt: now,
      createdBy: session.userId,
      updatedBy: session.userId
    });
    const { values, warning } = await resolveTrilingual(d1, env, {
      label: { ka: label, en: '', ru: '' }
    });
    for (const locale of ['ka', 'en', 'ru'] as const) {
      await upsertLabel(db, id, locale, values.label[locale]);
    }
    await logAudit(db, {
      actorId: session.userId,
      action: 'create',
      entityType: 'stat',
      entityId: id
    });
    await purgeTags(event.platform!.env, ['home', 'stats']);
    return { created: true, warning };
  },

  update: async (event) => {
    const { db, form } = await adminForm(event, 'editor');
    const statId = String(form.get('stat_id') ?? '');
    await db
      .update(stats)
      .set({
        value: String(form.get('value') ?? '').trim(),
        unit: String(form.get('unit') ?? '').trim() || null,
        sort: Number(form.get('sort')) || 0,
        updatedAt: new Date().toISOString()
      })
      .where(eq(stats.id, statId));
    await purgeTags(event.platform!.env, ['home', 'stats']);
    return { saved: true };
  },

  setLabels: async (event) => {
    const { d1, db, form, env } = await adminForm(event, 'editor');
    const statId = String(form.get('stat_id') ?? '');
    const input = triFromForm(form, 'label');
    if (!input.ka) return fail(400, { error: 'ქართული წარწერა სავალდებულოა' });

    const { values, warning } = await resolveTrilingual(d1, env, { label: input });
    for (const locale of ['ka', 'en', 'ru'] as const) {
      await upsertLabel(db, statId, locale, values.label[locale]);
    }
    await purgeTags(event.platform!.env, ['home', 'stats']);
    return { saved: true, warning };
  },

  delete: async (event) => {
    const { db, form, session } = await adminForm(event, 'admin');
    const id = String(form.get('stat_id') ?? '');
    await db.delete(statI18n).where(eq(statI18n.statId, id));
    await db.delete(stats).where(eq(stats.id, id));
    await logAudit(db, {
      actorId: session.userId,
      action: 'delete',
      entityType: 'stat',
      entityId: id
    });
    await purgeTags(event.platform!.env, ['home', 'stats']);
    return { deleted: true };
  }
};
