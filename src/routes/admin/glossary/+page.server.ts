import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { glossary } from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';
import { adminForm, requireRole } from '$lib/server/admin/guard';
import { resolveTrilingual } from '$lib/server/admin/i18n-forms';

export const load: PageServerLoad = async ({ locals, platform }) => {
  requireRole(locals, 'editor');
  if (!platform?.env?.DB) error(503, 'Database unavailable');
  const db = createDb(platform.env.DB);
  const rows = await db.select().from(glossary).orderBy(asc(glossary.termKa));
  return { items: rows, csrf: locals.session!.csrfToken };
};

export const actions: Actions = {
  create: async (event) => {
    const { d1, db, form, env } = await adminForm(event, 'editor');
    const termKa = String(form.get('term_ka') ?? '').trim();
    if (!termKa) return fail(400, { error: 'ქართული ტერმინი სავალდებულოა' });

    const { values, warning } = await resolveTrilingual(d1, env, {
      term: {
        ka: termKa,
        en: String(form.get('term_en') ?? '').trim(),
        ru: String(form.get('term_ru') ?? '').trim()
      }
    });
    if (!values.term.en || !values.term.ru) {
      return fail(400, { error: warning ?? 'EN/РУ ტერმინები ვერ განისაზღვრა' });
    }
    await db.insert(glossary).values({
      id: crypto.randomUUID(),
      termKa,
      termEn: values.term.en,
      termRu: values.term.ru,
      note: String(form.get('note') ?? '').trim() || null
    });
    return { created: true, warning };
  },

  update: async (event) => {
    const { d1, db, form, env } = await adminForm(event, 'editor');
    const id = String(form.get('id') ?? '');
    const termKa = String(form.get('term_ka') ?? '').trim();
    if (!termKa) return fail(400, { error: 'ქართული ტერმინი სავალდებულოა' });

    const existing = await db.select().from(glossary).where(eq(glossary.id, id)).get();
    if (!existing) return fail(404, { error: 'Not found' });

    const { values, warning } = await resolveTrilingual(d1, env, {
      term: {
        ka: termKa,
        en: String(form.get('term_en') ?? '').trim(),
        ru: String(form.get('term_ru') ?? '').trim()
      }
    });
    await db
      .update(glossary)
      .set({
        termKa,
        termEn: values.term.en || existing.termEn,
        termRu: values.term.ru || existing.termRu,
        note: String(form.get('note') ?? '').trim() || null,
        version: existing.version + 1
      })
      .where(eq(glossary.id, id));
    return { saved: true, warning };
  },

  delete: async (event) => {
    const { db, form } = await adminForm(event, 'admin');
    await db.delete(glossary).where(eq(glossary.id, String(form.get('id') ?? '')));
    return { deleted: true };
  }
};
