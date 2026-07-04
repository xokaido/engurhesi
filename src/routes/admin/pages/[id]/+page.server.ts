import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { media, pageI18n, pages } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { adminForm, requireRole } from '$lib/server/admin/guard';
import { saveEntityI18n, removeEntityFromIndex } from '$lib/server/content/save';
import { setPublishStatus } from '$lib/server/admin/publish';
import { logAudit } from '$lib/server/audit';
import { translateEntity } from '$lib/server/translate/service';
import type { Locale } from '$lib/i18n';

export const load: PageServerLoad = async ({ locals, params, platform }) => {
  requireRole(locals, 'draft_editor');
  if (!platform?.env?.DB) error(503, 'Database unavailable');
  const db = createDb(platform.env.DB);

  const page = await db.select().from(pages).where(eq(pages.id, params.id)).get();
  if (!page) error(404, 'Not found');

  const [i18nRows, images] = await Promise.all([
    db.select().from(pageI18n).where(eq(pageI18n.pageId, page.id)),
    db
      .select({ id: media.id, filename: media.originalFilename })
      .from(media)
      .where(and(eq(media.kind, 'image'), eq(media.status, 'active')))
      .orderBy(desc(media.createdAt))
      .limit(200)
  ]);

  return {
    page,
    i18n: i18nRows,
    images,
    csrf: locals.session!.csrfToken,
    role: locals.session!.role,
    hasOpenRouter: !!platform.env.OPENROUTER_API_KEY
  };
};

export const actions: Actions = {
  save: async (event) => {
    const { d1, db, form, session, env } = await adminForm(event, 'draft_editor');
    const id = event.params.id;
    const locale = String(form.get('locale') ?? 'ka') as Locale;
    if (!['ka', 'en', 'ru'].includes(locale)) return fail(400, { error: 'Invalid locale' });

    const page = await db.select().from(pages).where(eq(pages.id, id)).get();
    if (!page) return fail(404, { error: 'Not found' });

    const title = String(form.get('title') ?? '').trim();
    if (!title && locale === 'ka') return fail(400, { error: 'სათაური სავალდებულოა' });

    const result = await saveEntityI18n(
      d1,
      'page',
      id,
      locale,
      {
        title,
        bodyJson: String(form.get('body') ?? '') || null,
        extras: {
          seo_title: String(form.get('seo_title') ?? '').trim() || null,
          seo_description: String(form.get('seo_description') ?? '').trim() || null
        }
      },
      session.userId
    );
    if (!result.ok) return fail(400, { error: result.error });

    if (locale === 'ka') {
      const sort = Number(form.get('sort')) || 0;
      await db.update(pages).set({ sort }).where(eq(pages.id, id));
    }

    let translated = false;
    let warning: string | undefined;
    if (locale === 'ka' && String(form.get('autotranslate') ?? '') === '1') {
      const tr = await translateEntity(d1, env, 'page', id, session.userId);
      if (tr.ok) translated = (tr.locales?.length ?? 0) > 0;
      else warning = `ავტომატური თარგმანი ვერ შესრულდა: ${tr.error}`;
    }

    return { saved: true, locale, translated, warning };
  },

  publish: async (event) => {
    const { d1, session, env } = await adminForm(event, 'editor');
    await setPublishStatus(d1, env, 'page', event.params.id, true, session.userId);
    return { published: true };
  },

  unpublish: async (event) => {
    const { d1, session, env } = await adminForm(event, 'editor');
    await setPublishStatus(d1, env, 'page', event.params.id, false, session.userId);
    return { unpublished: true };
  },

  delete: async (event) => {
    const { d1, db, session } = await adminForm(event, 'admin');
    const id = event.params.id;
    await removeEntityFromIndex(d1, 'page', id);
    await db.delete(pageI18n).where(eq(pageI18n.pageId, id));
    await db.delete(pages).where(eq(pages.id, id));
    await logAudit(db, {
      actorId: session.userId,
      action: 'delete',
      entityType: 'page',
      entityId: id
    });
    redirect(303, '/admin/pages');
  },

  translate: async (event) => {
    const { d1, session, env } = await adminForm(event, 'draft_editor');
    const result = await translateEntity(d1, env, 'page', event.params.id, session.userId);
    if (!result.ok) return fail(502, { error: result.error });
    return { translated: true };
  }
};
