import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import {
  articleI18n,
  articleMedia,
  articles,
  contentRevisions,
  media,
  redirects
} from '$lib/server/db/schema';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { adminForm, requireRole } from '$lib/server/admin/guard';
import { saveEntityI18n } from '$lib/server/content/save';
import { setPublishStatus } from '$lib/server/admin/publish';
import { logAudit } from '$lib/server/audit';
import { translateEntity } from '$lib/server/translate/service';
import { removeEntityFromIndex } from '$lib/server/content/save';
import type { Locale } from '$lib/i18n';

export const load: PageServerLoad = async ({ locals, params, platform }) => {
  requireRole(locals, 'draft_editor');
  if (!platform?.env?.DB) error(503, 'Database unavailable');
  const db = createDb(platform.env.DB);

  const article = await db.select().from(articles).where(eq(articles.id, params.id)).get();
  if (!article) error(404, 'Not found');

  const [i18nRows, galleryRows, images, revisions] = await Promise.all([
    db.select().from(articleI18n).where(eq(articleI18n.articleId, article.id)),
    db
      .select()
      .from(articleMedia)
      .where(eq(articleMedia.articleId, article.id))
      .orderBy(asc(articleMedia.sort)),
    db
      .select({ id: media.id, filename: media.originalFilename })
      .from(media)
      .where(and(eq(media.kind, 'image'), eq(media.status, 'active')))
      .orderBy(desc(media.createdAt))
      .limit(200),
    db
      .select({
        id: contentRevisions.id,
        locale: contentRevisions.locale,
        version: contentRevisions.version,
        title: contentRevisions.title,
        createdAt: contentRevisions.createdAt
      })
      .from(contentRevisions)
      .where(
        and(eq(contentRevisions.entityType, 'article'), eq(contentRevisions.entityId, article.id))
      )
      .orderBy(desc(contentRevisions.createdAt))
      .limit(15)
  ]);

  return {
    article,
    i18n: i18nRows,
    gallery: galleryRows.map((g) => g.mediaId),
    images,
    revisions,
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

    const article = await db.select().from(articles).where(eq(articles.id, id)).get();
    if (!article) return fail(404, { error: 'Not found' });

    const title = String(form.get('title') ?? '').trim();
    if (!title && locale === 'ka') return fail(400, { error: 'სათაური სავალდებულოა' });

    const result = await saveEntityI18n(
      d1,
      'article',
      id,
      locale,
      {
        title,
        bodyJson: String(form.get('body') ?? '') || null,
        extras: {
          excerpt: String(form.get('excerpt') ?? '').trim() || null,
          seo_description: String(form.get('seo_description') ?? '').trim() || null
        }
      },
      session.userId
    );
    if (!result.ok) return fail(400, { error: result.error });

    // base fields (KA tab only)
    if (locale === 'ka') {
      const category = String(form.get('category') ?? article.category);
      const coverMediaId = String(form.get('cover_media_id') ?? '') || null;
      const newSlug = String(form.get('slug') ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '');

      const updates: Partial<typeof articles.$inferInsert> = {
        category: category as 'news' | 'announcement' | 'publication',
        coverMediaId
      };

      // slug: free while draft; auto-redirect once published
      if (newSlug && newSlug !== article.slug) {
        const clash = await db.select().from(articles).where(eq(articles.slug, newSlug)).get();
        if (!clash) {
          if (article.status === 'published') {
            for (const l of ['ka', 'en', 'ru']) {
              await db
                .insert(redirects)
                .values({
                  oldPath: `/${l}/news/${article.slug}`,
                  newPath: `/${l}/news/${newSlug}`,
                  statusCode: 301,
                  note: 'slug change'
                })
                .onConflictDoUpdate({
                  target: redirects.oldPath,
                  set: { newPath: `/${l}/news/${newSlug}` }
                });
            }
          }
          updates.slug = newSlug;
        }
      }

      await db.update(articles).set(updates).where(eq(articles.id, id));

      // gallery: ordered comma-separated media ids
      const gallery = String(form.get('gallery') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await db.delete(articleMedia).where(eq(articleMedia.articleId, id));
      if (gallery.length > 0) {
        const validMedia = await db
          .select({ id: media.id })
          .from(media)
          .where(and(inArray(media.id, gallery), eq(media.status, 'active')));
        const validIds = new Set(validMedia.map((m) => m.id));
        const rows = gallery
          .filter((g) => validIds.has(g))
          .map((mediaId, index) => ({ articleId: id, mediaId, sort: index }));
        if (rows.length > 0) await db.insert(articleMedia).values(rows);
      }
    }

    // auto-translate EN/RU from the fresh Georgian content (opt-out checkbox)
    let translated = false;
    let warning: string | undefined;
    if (locale === 'ka' && String(form.get('autotranslate') ?? '') === '1') {
      const tr = await translateEntity(d1, env, 'article', id, session.userId);
      if (tr.ok) translated = (tr.locales?.length ?? 0) > 0;
      else warning = `ავტომატური თარგმანი ვერ შესრულდა: ${tr.error}`;
    }

    return { saved: true, locale, translated, warning };
  },

  publish: async (event) => {
    const { d1, session, env } = await adminForm(event, 'editor');
    await setPublishStatus(d1, env, 'article', event.params.id, true, session.userId);
    return { published: true };
  },

  unpublish: async (event) => {
    const { d1, session, env } = await adminForm(event, 'editor');
    await setPublishStatus(d1, env, 'article', event.params.id, false, session.userId);
    return { unpublished: true };
  },

  delete: async (event) => {
    const { d1, db, session } = await adminForm(event, 'editor');
    const id = event.params.id;
    await removeEntityFromIndex(d1, 'article', id);
    await db.delete(articleMedia).where(eq(articleMedia.articleId, id));
    await db.delete(articleI18n).where(eq(articleI18n.articleId, id));
    await db.delete(articles).where(eq(articles.id, id));
    await logAudit(db, {
      actorId: session.userId,
      action: 'delete',
      entityType: 'article',
      entityId: id
    });
    redirect(303, '/admin/news');
  },

  translate: async (event) => {
    const { d1, session, env } = await adminForm(event, 'draft_editor');
    const result = await translateEntity(d1, env, 'article', event.params.id, session.userId);
    if (!result.ok) return fail(502, { error: result.error });
    await logAudit(createDb(d1), {
      actorId: session.userId,
      action: 'translate',
      entityType: 'article',
      entityId: event.params.id,
      detail: { locales: result.locales }
    });
    return { translated: true };
  },

  restore: async (event) => {
    const { d1, db, form, session } = await adminForm(event, 'draft_editor');
    const revisionId = String(form.get('revision_id') ?? '');
    const revision = await db
      .select()
      .from(contentRevisions)
      .where(eq(contentRevisions.id, revisionId))
      .get();
    if (!revision || revision.entityId !== event.params.id) {
      return fail(404, { error: 'Revision not found' });
    }
    // restore-as-draft: content comes back, entity stays in its current status
    const result = await saveEntityI18n(
      d1,
      'article',
      event.params.id,
      revision.locale as Locale,
      { title: revision.title, bodyJson: revision.bodyJson },
      session.userId
    );
    if (!result.ok) return fail(400, { error: result.error });
    return { restored: true };
  }
};
